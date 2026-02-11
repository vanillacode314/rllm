import { fromBinary } from '@bufbuild/protobuf';
import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, useBlocker } from '@tanstack/solid-router';
import { ethers } from 'ethers';
import { SyncServerGetEventsResponseSchema } from 'proto/event_pb';
import { Match, Switch } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { AsyncResult } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { setSaveMnemonicModalOpen } from '~/components/modals/auto-import/SaveMnemonicModal';
import { Button } from '~/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '~/components/ui/card';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { deleteDatabaseFile, logger } from '~/db/client';
import { queries } from '~/queries';
import { account, setAccount } from '~/signals/account';
import { withTransaction } from '~/utils/db';
import { queryClient } from '~/utils/query-client';
import {
	createAuthenticatedSyncServerFetcher,
	getServerId,
	parseEventsFromServer,
	syncServerFetcher
} from '~/utils/sync-server';

export const Route = createFileRoute('/settings/account')({
	component: SettingsAccountComponent,
	async loader() {
		await queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name'));
	}
});

function SettingsAccountComponent() {
	const [status, setStatus] = createStore<{
		loading: boolean;
		processed: number;
	}>({ loading: false, processed: 0 });

	useBlocker({
		shouldBlockFn: () => false,
		enableBeforeUnload: () => status.loading
	});

	const displayName = useQuery(() => queries.userMetadata.byId('user-display-name'));

	async function createNewAccount() {
		const wallet = ethers.Wallet.createRandom();
		setSaveMnemonicModalOpen(wallet.mnemonic!.phrase);
		const account = await saveAccount(wallet);
		setAccount(account);
	}

	async function saveAccount(wallet: ethers.HDNodeWallet) {
		const seed = wallet.mnemonic!.entropy;
		const salt = new Uint8Array(16);
		const iterations = 650_000;

		const encoder = new TextEncoder();
		const derivedKey = await window.crypto.subtle.importKey(
			'raw',
			encoder.encode(seed),
			{ name: 'PBKDF2' },
			false,
			['deriveKey']
		);
		const aesKey = await window.crypto.subtle.deriveKey(
			{
				name: 'PBKDF2',
				salt: salt,
				iterations: iterations,
				hash: 'SHA-256'
			},
			derivedKey,
			{ name: 'AES-GCM', length: 256 },
			true,
			['encrypt', 'decrypt']
		);
		const jsonAesKey = await window.crypto.subtle.exportKey('jwk', aesKey);
		return {
			privateKey: wallet.privateKey,
			publicKey: wallet.publicKey,
			aesKey: jsonAesKey,
			id: wallet.address
		};
	}

	const login = () =>
		tryBlock(
			async function* () {
				const passphrase = prompt(
					'Enter your passphrase (make sure the words are seperated by 1 space)'
				);
				if (!passphrase) {
					alert('Passphrase is required');
					return;
				}
				const isValid = ethers.Mnemonic.isValidMnemonic(passphrase);
				if (!isValid) {
					alert('Invalid passphrase');
					return;
				}

				const { publicKey, privateKey, id, aesKey } = await saveAccount(
					ethers.Wallet.fromPhrase(passphrase)
				);

				setStatus('loading', true);
				yield* withTransaction((tx) =>
					tryBlock(
						async function* () {
							const serverId = yield* getServerId();
							const stream = await syncServerFetcher('/api/v1/messages/stream', {
								responseType: 'stream',
								query: { accountId: id }
							});
							const reader = stream.getReader();
							let accumulated = new Uint8Array(0);

							while (true) {
								const { done, value } = await reader.read();
								if (done) break;

								const next = new Uint8Array(accumulated.length + value.length);
								next.set(accumulated);
								next.set(value, accumulated.length);
								accumulated = next;

								while (accumulated.length >= 4) {
									const view = new DataView(
										accumulated.buffer,
										accumulated.byteOffset,
										accumulated.byteLength
									);
									const messageLength = view.getUint32(0, true);
									if (accumulated.length >= 4 + messageLength) {
										const messageBytes = accumulated.slice(4, 4 + messageLength);

										const data = yield* AsyncResult.from(
											async () => fromBinary(SyncServerGetEventsResponseSchema, messageBytes),
											(error) => new Error('Failed to decode protobuf', { cause: error })
										);

										const actualAesKey = await window.crypto.subtle.importKey(
											'jwk',
											aesKey,
											{ name: 'AES-GCM' },
											true,
											['encrypt', 'decrypt']
										);

										const messages = await parseEventsFromServer(data, actualAesKey);
										await logger.receive(serverId, messages, tx);
										setStatus({ processed: status.processed + messages.length });

										accumulated = accumulated.slice(4 + messageLength);
									} else {
										break;
									}
								}
							}
						},
						(e) => e
					)
				);
				setAccount({ publicKey, privateKey, aesKey, id });
				setStatus({ loading: false, processed: 0 });
				location.reload();
			},
			(e) => new Error('Failed to login', { cause: e })
		).finally(() => {
			setStatus({ loading: false, processed: 0 });
		});

	async function logout() {
		const yes = confirm(
			'Are you sure you want to logout? This will remove all your data from this device.'
		);
		if (!yes) return;
		setAccount(null);
		localStorage.clear();
		await deleteDatabaseFile();
		location.reload();
	}

	async function deleteAccount() {
		const yes = confirm(
			'Are you sure you want to delete your account? This will remove all your data from this device and the server.'
		);
		if (!yes) return;
		const fetcher = await createAuthenticatedSyncServerFetcher().unwrap();
		const accountId = account()!.id;
		await fetcher('/api/v1/account', { method: 'DELETE', body: { accountId } });
		setAccount(null);
		localStorage.clear();
		await deleteDatabaseFile();
		location.reload();
	}

	return (
		<div class="flex flex-col gap-4">
			<Switch>
				<Match when={status.loading}>
					<Card>
						<CardHeader>
							<CardTitle>Syncing data ({status.processed} processed)</CardTitle>
						</CardHeader>
						<CardContent class="grid place-items-center gap-4">
							<span class="icon-[svg-spinners--180-ring-with-bg] text-5xl" />
						</CardContent>
					</Card>
				</Match>

				<Match when={account()}>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
							if (typeof formData.displayName !== 'string') return;
							if (formData.displayName === displayName.data) {
								toast.info('No changes made');
								return;
							}
							await logger.dispatch({
								type: 'setUserMetadata',
								data: {
									id: 'user-display-name',
									value: formData.displayName
								}
							});
							toast.success('Display name updated');
						}}
					>
						<Card>
							<CardHeader>
								<CardTitle>Account</CardTitle>
								<CardDescription class="wrap-anywhere">ID: {account()!.id}</CardDescription>
							</CardHeader>
							<CardContent class="wrap-anywhere">
								<TextField class="space-y-1.5">
									<TextFieldLabel>Display Name</TextFieldLabel>
									<TextFieldInput
										name="displayName"
										placeholder="Enter your display name"
										type="text"
										value={displayName.data ?? ''}
									/>
								</TextField>
							</CardContent>
							<CardFooter class="flex justify-end gap-4">
								<Button
									class="max-sm:w-full"
									onClick={() => logout()}
									type="button"
									variant="ghost"
								>
									<span class="icon-[heroicons--arrow-right-on-rectangle]" />
									<span>Logout</span>
								</Button>
								<Button class="max-sm:w-full" type="submit">
									<span class="icon-[heroicons--check]" />
									<span>Save</span>
								</Button>
							</CardFooter>
						</Card>
					</form>
					<Card>
						<CardHeader>
							<CardTitle>Danger</CardTitle>
							<CardDescription>The following settings can lead to data loss.</CardDescription>
						</CardHeader>
						<CardContent class="flex max-sm:flex-col">
							<Button
								onClick={() =>
									toast.promise(
										() =>
											deleteAccount().catch((e) => {
												console.error(e);
												throw e;
											}),
										{
											loading: 'Deleting account...',
											success: 'Account deleted',
											error: 'Failed to delete account'
										}
									)
								}
								type="button"
								variant="destructive"
							>
								Delete Account
							</Button>
						</CardContent>
					</Card>
				</Match>
				<Match when={true}>
					<Card>
						<CardHeader>
							<CardTitle>Account</CardTitle>
							<CardDescription class="prose max-w-none">
								<p>
									If you would like to sync your data across devices, you can login or create a new
									account.
								</p>
								<p>All your data is encrypted before it is sent from your device.</p>
							</CardDescription>
						</CardHeader>
						<CardContent class="max-sm:flex-col flex gap-4">
							<Button onClick={() => createNewAccount()}>
								<span class="icon-[heroicons--plus]" />
								<span>Create new account</span>
							</Button>
							<Button
								onClick={async () =>
									(await login())
										.inspectErr(() => {
											toast.error('Failed to login. If this persists, please contact support');
										})
										.unwrap()
								}
							>
								<span class="icon-[heroicons--arrow-left-on-rectangle]" />
								<span>Login</span>
							</Button>
						</CardContent>
					</Card>
				</Match>
			</Switch>
		</div>
	);
}
