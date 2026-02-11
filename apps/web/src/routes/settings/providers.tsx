import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';

import { setAddProviderModalOpen } from '~/components/modals/auto-import/AddProviderModal';
import { setEditProviderModalOpen } from '~/components/modals/auto-import/EditProviderModal';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/providers')({
	component: SettingsProviderComponent,
	loader: async () => {
		return queryClient.ensureQueryData(queries.providers.all());
	}
});

function SettingsProviderComponent() {
	const providers = useQuery(queries.providers.all);

	async function deleteProvider(id: string) {
		const yes = confirm('Are you sure you want to delete this provider?');
		if (!yes) return;
		await logger.dispatch({
			type: 'deleteProvider',
			data: { id }
		});
	}

	return (
		<div class="grid grid-rows-[auto_1fr] gap-8">
			<Show
				fallback={
					<div class="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
						<span class="icon-[heroicons--cube] text-muted-foreground text-4xl" />
						<p class="text-muted-foreground">No providers configured</p>
						<Button onClick={() => setAddProviderModalOpen(true)}>Add Provider</Button>
					</div>
				}
				when={providers.data && providers.data.length > 0}
			>
				<div class="flex justify-end items-center">
					<Button onClick={() => setAddProviderModalOpen(true)}>Add Provider</Button>
				</div>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 self-start">
					<For each={providers.data}>
						{(provider) => (
							<Card class="flex flex-col">
								<CardHeader>
									<CardTitle>{provider.name}</CardTitle>
								</CardHeader>
								<CardContent class="grow">
									<p class="wrap-anywhere">{provider.baseUrl}</p>
								</CardContent>
								<CardFooter class="max-sm:grid grid-cols-[auto_1fr] justify-end gap-2">
									<Button
										onClick={() => deleteProvider(provider.id)}
										size="icon"
										variant="destructive"
									>
										<span class="icon-[heroicons--trash]" />
										<span class="sr-only">Delete</span>
									</Button>
									<Button onClick={() => setEditProviderModalOpen(provider.id)} variant="secondary">
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
