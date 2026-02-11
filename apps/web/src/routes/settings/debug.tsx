import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { HLC } from 'hlc';
import { createMemo, For, Show } from 'solid-js';
import { z } from 'zod/mini';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationItems,
	PaginationNext,
	PaginationPrevious
} from '~/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';
import { getServerId } from '~/utils/sync-server';

const pageSize = 100;

export const Route = createFileRoute('/settings/debug')({
	component: SettingsDebugComponent,
	validateSearch: z.object({
		page: z.optional(z.number().check(z.minimum(1)))
	}),
	loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
	staleTime: 0,
	loader: async ({ deps }) => {
		const { page } = deps;
		const [clientId, serverId] = await Promise.all([
			logger.getClientId(),
			(await getServerId().ok()).toNull(),
			queryClient.ensureQueryData(queries.events.count()),
			queryClient.ensureQueryData(queries.events.all(page, pageSize))
		]);
		const latestSentAt = serverId ? await logger.getLatestSentAt(serverId) : '0';
		return { clientId, latestSentAt };
	}
});

function getClientIdFromTimestamp(timestamp: string): string {
	const clock = HLC.fromString(timestamp);
	return clock.clientId;
}

function SettingsDebugComponent() {
	const searchParams = Route.useSearch();
	const navigate = Route.useNavigate();
	const loaderData = Route.useLoaderData();

	const currentPage = () => searchParams().page ?? 1;

	const countQuery = useQuery(queries.events.count);
	const eventsQuery = useQuery(() => queries.events.all(currentPage(), pageSize));

	const totalPages = createMemo(() => Math.ceil((countQuery.data ?? 0) / pageSize));

	const clientId = () => loaderData().clientId;
	const latestSentAt = () => loaderData().latestSentAt;

	const isLocalEvent = (timestamp: string) => {
		const eventClientId = getClientIdFromTimestamp(timestamp);
		return eventClientId === clientId();
	};

	const isSynced = (timestamp: string) => {
		return timestamp <= latestSentAt();
	};

	return (
		<Tabs class="w-full" defaultValue="events">
			<TabsList>
				<TabsTrigger value="events">Events</TabsTrigger>
			</TabsList>
			<TabsContent class="space-y-4" value="events">
				<div class="flex items-center justify-between">
					<div class="text-sm text-muted-foreground">
						Showing {Math.min((currentPage() - 1) * pageSize + 1, countQuery.data ?? 0)} to{' '}
						{Math.min(currentPage() * pageSize, countQuery.data ?? 0)} of {countQuery.data ?? 0}{' '}
						events
					</div>
					<Pagination
						count={totalPages()}
						ellipsisComponent={() => <PaginationEllipsis />}
						fixedItems
						itemComponent={(props) => (
							<PaginationItem page={props.page}>{props.page}</PaginationItem>
						)}
						onPageChange={(page) => navigate({ search: { page } })}
						page={currentPage()}
					>
						<PaginationPrevious />
						<PaginationItems />
						<PaginationNext />
					</Pagination>
				</div>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
					<For each={eventsQuery.data ?? []}>
						{(event) => (
							<Card>
								<CardHeader>
									<div class="flex items-center justify-between">
										<div>
											<CardTitle class="font-mono text-xs">{event.type}</CardTitle>
											<Show when={event.version}>
												<p class="font-mono text-[10px] text-muted-foreground">v{event.version}</p>
											</Show>
										</div>
										<div class="flex items-center gap-2">
											<Show
												fallback={
													<span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
														Remote
													</span>
												}
												when={isLocalEvent(event.timestamp)}
											>
												<span class="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
													Local
												</span>
											</Show>
											<Show when={isLocalEvent(event.timestamp)}>
												<Show
													fallback={
														<span class="rounded bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
															Not Synced
														</span>
													}
													when={isSynced(event.timestamp)}
												>
													<span class="rounded bg-green-500 px-1.5 py-0.5 text-[10px] text-white">
														Synced
													</span>
												</Show>
											</Show>
										</div>
									</div>
									<p class="font-mono text-xs text-muted-foreground">{event.timestamp}</p>
								</CardHeader>
								<CardContent>
									<pre class="max-h-[200px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
										{JSON.stringify(JSON.parse(event.data), null, 2)}
									</pre>
								</CardContent>
							</Card>
						)}
					</For>
				</div>
				<div class="flex items-center justify-between">
					<div class="text-sm text-muted-foreground">
						Showing {Math.min((currentPage() - 1) * pageSize + 1, countQuery.data ?? 0)} to{' '}
						{Math.min(currentPage() * pageSize, countQuery.data ?? 0)} of {countQuery.data ?? 0}{' '}
						events
					</div>
					<Pagination
						count={totalPages()}
						ellipsisComponent={() => <PaginationEllipsis />}
						fixedItems
						itemComponent={(props) => (
							<PaginationItem page={props.page}>{props.page}</PaginationItem>
						)}
						onPageChange={(page) => navigate({ search: { page } })}
						page={currentPage()}
					>
						<PaginationPrevious />
						<PaginationItems />
						<PaginationNext />
					</Pagination>
				</div>
			</TabsContent>
		</Tabs>
	);
}
