import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';

import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { setEditPresetModalOpen } from '~/components/modals/auto-import/EditPresetModal';
import { setChatSettingsDrawerOpen } from '~/components/TheChatSettingsDrawer';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { deletePreset, duplicatePreset, setDefaultPresetId } from '~/lib/chat/presets';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/presets')({
	component: PresetComponent,
	loader: async () => {
		await queryClient.ensureQueryData(queries.chatPresets.all());
		await queryClient.ensureQueryData(queries.userMetadata.byId('default-chat-settings-preset'));
	}
});

function PresetComponent() {
	const presets = useQuery(() => queries.chatPresets.all());
	const defaultPresetId = useQuery(() => queries.userMetadata.byId('default-chat-settings-preset'));
	const confirmDialog = useConfirmDialog();

	return (
		<div class="flex flex-col gap-8 py-4 h-full overflow-hidden">
			<Show
				fallback={<div class="text-muted-foreground">Loading presets...</div>}
				when={presets.isSuccess && presets.data}
			>
				<Show
					fallback={
						<div class="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
							<span class="icon-[heroicons--cube] text-muted-foreground text-4xl" />
							<p class="text-muted-foreground">No presets saved yet</p>
							<Button onClick={() => setChatSettingsDrawerOpen(true)} type="button">
								Create Preset
							</Button>
						</div>
					}
					when={presets.data!.length > 0}
				>
					<div class="flex items-center justify-end px-4">
						<Button onClick={() => setChatSettingsDrawerOpen(true)} type="button" variant="default">
							<span class="icon-[heroicons--plus-16-solid]" />
							<span>Create Preset</span>
						</Button>
					</div>
					<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 self-start overflow-y-auto h-full px-4">
						<For each={presets.data}>
							{(preset) => (
								<Card class="flex flex-col">
									<CardHeader>
										<div class="flex items-center justify-between">
											<CardTitle class="text-lg">{preset.name}</CardTitle>
											<Show when={defaultPresetId.data === preset.id}>
												<span class="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
													Default
												</span>
											</Show>
										</div>
									</CardHeader>
									<CardContent class="grow">
										<div class="text-sm space-y-1">
											<p>
												<span class="text-muted-foreground">Model:</span> {preset.settings.modelId}
											</p>
											<p>
												<span class="text-muted-foreground">Provider:</span>{' '}
												{preset.settings.providerId}
											</p>
											<Show when={preset.settings.systemPrompt}>
												<div class="text-muted-foreground text-xs">
													<span class="font-medium">System Prompt:</span>
													<div class="mt-1 p-2 bg-muted rounded overflow-y-auto max-h-24 whitespace-pre-wrap">
														{preset.settings.systemPrompt}
													</div>
												</div>
											</Show>
										</div>
									</CardContent>
									<CardFooter class="max-sm:grid grid-cols-[auto_1fr] justify-end gap-2">
										<Show when={defaultPresetId.data !== preset.id}>
											<Button
												onClick={() => setDefaultPresetId(preset.id)}
												size="sm"
												variant="secondary"
											>
												Set Default
											</Button>
										</Show>
										<Show when={defaultPresetId.data === preset.id}>
											<Button onClick={() => setDefaultPresetId('')} size="sm" variant="secondary">
												Clear Default
											</Button>
										</Show>
										<Button
											onClick={() => setEditPresetModalOpen(preset.id)}
											size="sm"
											variant="secondary"
										>
											Edit
										</Button>
										<Button onClick={() => duplicatePreset(preset)} size="sm" variant="secondary">
											Duplicate
										</Button>
										<Button
											onClick={() => {
												confirmDialog.confirm({
													title: 'Delete Preset',
													description:
														'Are you sure you want to delete this preset? This action cannot be undone.',
													confirmText: 'Delete',
													variant: 'destructive',
													onConfirm: () => deletePreset(preset.id)
												});
											}}
											size="sm"
											variant="destructive"
										>
											Delete
										</Button>
									</CardFooter>
								</Card>
							)}
						</For>
					</div>
				</Show>
			</Show>
		</div>
	);
}
