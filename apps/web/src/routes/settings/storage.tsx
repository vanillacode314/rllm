import { useMutation, useQuery } from '@tanstack/solid-query';
import { createFileRoute, useBlocker } from '@tanstack/solid-router';
import { type } from 'arktype';
import { count, gt } from 'drizzle-orm';
import { ethers } from 'ethers';
import { createSignal, Match, onMount, Show, Switch } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';
import { releaseProxy } from 'vite-plugin-comlink/symbol';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { db, getDatabaseInfo } from '~/db/client';
import * as schema from '~/db/schema';
import { account } from '~/signals/account';
import { getMetadata, setMetadata } from '~/utils/db';
import { round } from '~/utils/math';
import { receiveMessages } from '~/utils/messages';
import { queryClient } from '~/utils/query-client';
import { createDebouncedMemo } from '~/utils/signals';
import { optimizeMessages, optimizeStorage as optimizeStorageUtil } from '~/utils/storage';
import { getMessages as getServerMessages } from '~/utils/sync-server';
import { createAuthenticatedSyncServerFetcher } from '~/utils/sync-server';
import { makeNewEncryptionWorker } from '~/workers/encryption';

export const Route = createFileRoute('/settings/storage')({
	component: SettingsStorageComponent,
	async loader() {
		const info = await getDatabaseInfo();
		await queryClient.ensureQueryData({
			queryKey: ['db', 'messages', 'count'],
			queryFn: () =>
				db
					.select({ count: count() })
					.from(schema.messages)
					.then((res) => res[0].count)
		});
		return { size: info.databaseSizeBytes ?? null };
	}
});

function formatBytes(value: number): string {
	if (value === 0) {
		return '0 B';
	}

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let i = 0;

	while (value >= 1024 && i < units.length - 1) {
		value /= 1024;
		i++;
	}

	value = round(value, 2);
	return `${value} ${units[i]}`;
}

function SettingsStorageComponent() {
	const data = Route.useLoaderData();
	const [size, setSize] = createSignal<null | number>(data().size);
	useBlocker({
		shouldBlockFn: () => false,
		enableBeforeUnload: () => optimizeStorage.isPending || optimizeServerStorage.isPending
	});

	onMount(updateSize);

	async function updateSize() {
		const info = await getDatabaseInfo();
		setSize(info.databaseSizeBytes ?? null);
	}

	const optimizeStorage = useMutation(() => ({
		mutationFn: () => optimizeStorageUtil().unwrap(),
		onSuccess: () => {
			updateSize();
			queryClient.invalidateQueries({ queryKey: ['db', 'messages', 'count'] });
		}
	}));

	const messages = useQuery(() => ({
		queryKey: ['db', 'messages', 'count'],
		queryFn: () =>
			db
				.select({ count: count() })
				.from(schema.messages)
				.then((res) => res[0].count)
	}));

	const optimizeStorageIsPending = createDebouncedMemo(() => optimizeStorage.isPending, false, {
		duration: 300
	});

	const [serverOptimizationStatus, setServerOptimizationStatus] = createStore<{
		processed: number;
		total: number;
		type: 'fetching' | 'sending';
	}>({
		type: 'fetching',
		processed: 0,
		total: 0
	});

	const optimizeServerStorage = useMutation(() => ({
		onMutate: async () => {
			await optimizeStorage.mutateAsync();
		},
		mutationFn: () =>
			tryBlock(
				async function* () {
					const fetcher = yield* createAuthenticatedSyncServerFetcher();
					const $account = account();
					if (!$account) throw new Error('No account found');
					const clientId = yield* getMetadata('clientId').andThen((value) =>
						value.okOrElse(() => new Error('No client ID found'))
					);

					setServerOptimizationStatus({
						type: 'fetching'
					});

					{
						const toInvalidate: string[][] = [];
						let after: null | string = null;
						while (true) {
							const { nextAfter, messages, hasMore } = yield* getServerMessages(
								$account.id,
								$account.aesKey,
								{ after, clientId }
							);

							toInvalidate.push(...(yield* receiveMessages(await optimizeMessages(messages))));
							if (!hasMore) break;
							after = nextAfter as null | string;
						}
						await Promise.all(
							toInvalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
						);
					}

					const lastPullAt = yield* getMetadata('lastPullAt').andThen((value) =>
						value.okOrElse(() => new Error('No last pull time found'))
					);
					const lastPushAt = (
						await getMetadata('lastPushAt').unwrapOrElse(() => Option.None())
					).toNull();

					const wallet = new ethers.Wallet($account.privateKey);

					const aesKey = await window.crypto.subtle.importKey(
						'jwk',
						$account.aesKey,
						{ name: 'AES-GCM' },
						true,
						['encrypt', 'decrypt']
					);

					const [{ count: total }] = await db.select({ count: count() }).from(schema.messages);
					setServerOptimizationStatus({
						type: 'sending',
						processed: 0,
						total
					});
					await fetcher('/api/v1/messages', {
						method: 'DELETE',
						body: {
							accountId: $account.id,
							before: lastPushAt && lastPullAt < lastPushAt ? lastPushAt : lastPullAt
						}
					});

					const pageSize = 200;
					let localAfter: null | string = null;
					const getMessages = (after?: string) =>
						db
							.select()
							.from(schema.messages)
							.where(gt(schema.messages.timestamp, after!).if(after))
							.orderBy(schema.messages.timestamp)
							.limit(pageSize + 1);

					let hasMore = true;
					let messages = await getMessages();

					const encryptionWorker = makeNewEncryptionWorker();
					while (hasMore) {
						hasMore = messages.length > pageSize;
						if (hasMore) messages.pop();

						const data = await encryptionWorker.encrypt(JSON.stringify(messages), aesKey);
						const signature = await wallet.signMessage(data);
						const text = await fetcher('/api/v1/messages', {
							method: 'POST',
							body: {
								accountId: $account.id,
								clientId,
								data,
								signature
							},
							responseType: 'text'
						});
						const { timestamp } = yield* safeParseJson(text, {
							validate: type({ timestamp: 'string' }).assert
						});
						await setMetadata('lastPushAt', timestamp).unwrap();
						setServerOptimizationStatus({
							processed: serverOptimizationStatus.processed + messages.length
						});
						localAfter = messages.at(-1)!.timestamp;
						messages = await getMessages(localAfter);
					}
					encryptionWorker[releaseProxy]();
				},
				(e) => new Error(`Failed to optimize server storage`, { cause: e })
			).unwrap(),
		onError: (error) => {
			console.error(error);
		}
	}));

	return (
		<div class="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Optimize</CardTitle>
					<CardDescription>
						You only really need to do these very rarely like once a year.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p class="text-sm font-bold mb-4">
						{size() ? formatBytes(size()!) : 'Unknown'} currently in use
					</p>
					<div class="flex max-sm:flex-col gap-4">
						<Button
							disabled={optimizeStorage.isPending}
							onClick={() =>
								optimizeStorage.mutate(undefined, {
									onSuccess: () => toast.success('Done'),
									onError: (e) => {
										console.error(e);
										toast.error('An Error Occured');
									}
								})
							}
						>
							<Show when={optimizeStorageIsPending()}>
								<span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
							</Show>
							<span>Optimize Local Storage ({messages.data} events)</span>
						</Button>
						<Show when={account()}>
							<Button
								disabled={optimizeServerStorage.isPending}
								onClick={() => {
									const yes = confirm(
										'This operation can take a while. You only have to do this on 1 of your devices. The app must be online and you must not close it. Are you sure you want to proceed?'
									);
									if (!yes) return;
									optimizeServerStorage.mutate(undefined, {
										onSuccess: () => toast.success('Done'),
										onError: () => toast.error('An Error Occured')
									});
								}}
							>
								<Show
									fallback={<span>Optimize Server Storage</span>}
									when={optimizeServerStorage.isPending}
								>
									<Switch>
										<Match when={serverOptimizationStatus.type === 'fetching'}>
											<span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
											<span>Fetching Latest Messages</span>
										</Match>
										<Match when={serverOptimizationStatus.type === 'sending'}>
											<span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
											<span>
												{serverOptimizationStatus.processed} / {serverOptimizationStatus.total}{' '}
												Messages Synced
											</span>
										</Match>
									</Switch>
								</Show>
							</Button>
						</Show>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
