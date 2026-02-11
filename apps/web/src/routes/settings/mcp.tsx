import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';

import { setAddMCPModalOpen } from '~/components/modals/auto-import/AddMCPModal';
import { setEditMCPModalOpen } from '~/components/modals/auto-import/EditMCPModal';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/mcp')({
	component: SettingsMCPComponent,
	loader: async () => {
		return queryClient.ensureQueryData(queries.mcps.all());
	}
});

function SettingsMCPComponent() {
	const mcps = useQuery(queries.mcps.all);

	async function deleteMCP(id: string) {
		const yes = confirm('Are you sure you want to delete this mcp?');
		if (!yes) return;
		await logger.dispatch({
			type: 'deleteMcp',
			data: { id }
		});
	}

	return (
		<div class="grid grid-rows-[auto_1fr] gap-8">
			<Show
				fallback={
					<div class="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
						<span class="icon-[heroicons--cube] text-muted-foreground text-4xl" />
						<p class="text-muted-foreground">No MCP servers configured</p>
						<Button onClick={() => setAddMCPModalOpen(true)}>Add MCP</Button>
					</div>
				}
				when={mcps.data && mcps.data.length > 0}
			>
				<div class="flex justify-end items-center">
					<Button onClick={() => setAddMCPModalOpen(true)}>Add MCP</Button>
				</div>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 self-start">
					<For each={mcps.data}>
						{(mcp) => (
							<Card class="flex flex-col">
								<CardHeader>
									<CardTitle>{mcp.name}</CardTitle>
								</CardHeader>
								<CardContent class="grow">
									<p class="wrap-anywhere">{mcp.url}</p>
								</CardContent>
								<CardFooter class="max-sm:grid grid-cols-[auto_1fr] justify-end gap-2">
									<Button onClick={() => deleteMCP(mcp.id)} size="icon" variant="destructive">
										<span class="icon-[heroicons--trash]" />
										<span class="sr-only">Delete</span>
									</Button>
									<Button onClick={() => setEditMCPModalOpen(mcp.id)} variant="secondary">
										<span class="icon-[heroicons--pencil]" />
										<span>Edit</span>
									</Button>
								</CardFooter>
							</Card>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}
