import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { createMemo, For } from 'solid-js';
import Type from 'typebox';
import Value from 'typebox/value';

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
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

const pageSize = 100;

const QuerySchema = Type.Object({
	page: Type.Optional(Type.Number({ minimum: 1 }))
});

export const Route = createFileRoute('/settings/debug')({
	component: SettingsDebugComponent,
	validateSearch: (value) => Value.Parse(QuerySchema, value),
	loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
	loader: async ({ deps }) => {
		const page = deps.page;
		await Promise.all([
			queryClient.ensureQueryData(queries.events.count()),
			queryClient.ensureQueryData(queries.events.all(page, pageSize))
		]);
	}
});

function SettingsDebugComponent() {
	const searchParams = Route.useSearch();
	const navigate = Route.useNavigate();

	const currentPage = () => searchParams().page ?? 1;

	const countQuery = useQuery(queries.events.count);
	const eventsQuery = useQuery(() => queries.events.all(currentPage(), pageSize));

	const totalPages = createMemo(() => Math.ceil((countQuery.data ?? 0) / pageSize));

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
									<CardTitle class="font-mono text-xs">{event.type}</CardTitle>
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
