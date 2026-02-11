import { createWritableMemo } from '@solid-primitives/memo';
import { useQuery, useQueryClient } from '@tanstack/solid-query';
import { Link, useLocation } from '@tanstack/solid-router';
import { createMemo, createSignal, Show } from 'solid-js';

import { openAiAdapter } from '~/lib/adapters/openai';
import { createPreset, type TChatPreset } from '~/lib/chat/presets';
import { updateChatSettings } from '~/lib/chat/settings';
import { queries } from '~/queries';
import { chatSettings } from '~/routes/chat/-state';
import { isMobile } from '~/signals';

import ModelSelector from './ModelSelector';
import ProviderSelector from './ProviderSelector';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from './ui/drawer';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from './ui/text-field';

const [chatSettingsDrawerOpen, setChatSettingsDrawerOpen] = createSignal(false);

function PresetsSection(props: {
	currentSettings: () => { modelId: string; providerId: string; systemPrompt: string };
	onApplyPreset: (settings: { modelId: string; providerId: string; systemPrompt: string }) => void;
}) {
	const queryClient = useQueryClient();
	const [saveDialogOpen, setSaveDialogOpen] = createSignal(false);
	const [saveValue, setSaveValue] = createSignal('');

	const presets = useQuery(() => queries.chatPresets.all());
	const defaultPresetId = useQuery(() => queries.userMetadata.byId('default-chat-settings-preset'));

	const handleApplyPreset = (preset: TChatPreset) => {
		props.onApplyPreset({
			modelId: preset.settings.modelId,
			providerId: preset.settings.providerId,
			systemPrompt: preset.settings.systemPrompt
		});
	};

	const handleSavePreset = async (name: string) => {
		const settings = props.currentSettings();
		await createPreset(name, {
			modelId: settings.modelId,
			providerId: settings.providerId,
			systemPrompt: settings.systemPrompt
		});
		await queryClient.invalidateQueries({ queryKey: ['db', 'chatPresets', 'all'] });
		setSaveDialogOpen(false);
		setSaveValue('');
	};

	return (
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium">Presets</span>
				<Button onClick={() => setSaveDialogOpen(true)} size="sm" variant="outline">
					<span class="icon-[heroicons--document-plus-16-solid]" />
					<span>Save As Preset</span>
				</Button>
			</div>
			<Show
				fallback={<div class="text-sm text-muted-foreground">Loading presets...</div>}
				when={presets.isSuccess && presets.data}
			>
				<Show
					fallback={<div class="text-sm text-muted-foreground">No presets saved yet.</div>}
					when={presets.data!.length > 0}
				>
					<Select<TChatPreset>
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue.name}
								{defaultPresetId.data === itemProps.item.key && (
									<span class="ml-2 text-xs text-muted-foreground">(Default)</span>
								)}
							</SelectItem>
						)}
						onChange={(preset) => {
							if (preset) {
								handleApplyPreset(preset);
							}
						}}
						options={presets.data!}
						optionTextValue={(preset) => preset.name}
						optionValue={(preset) => preset.id}
						placeholder="Select a preset..."
						value={undefined}
					>
						<SelectTrigger class="w-full">
							<SelectValue<TChatPreset>>
								{(state) => state.selectedOption()?.name ?? 'Select a preset...'}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</Show>
			</Show>

			<Show when={presets.data && presets.data.length > 0}>
				<div class="text-xs text-muted-foreground">
					<Link
						class="underline hover:text-primary"
						onClick={() => setChatSettingsDrawerOpen(false)}
						to="/presets"
					>
						Manage presets
					</Link>
				</div>
			</Show>

			<Dialog onOpenChange={setSaveDialogOpen} open={saveDialogOpen()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Preset</DialogTitle>
					</DialogHeader>
					<div class="py-4">
						<TextField>
							<TextFieldLabel>Preset Name</TextFieldLabel>
							<TextFieldInput
								onInput={(e) => setSaveValue(e.currentTarget.value)}
								placeholder="My Custom Preset"
								value={saveValue()}
							/>
						</TextField>
					</div>
					<DialogFooter>
						<Button
							disabled={saveValue().trim() === ''}
							onClick={() => handleSavePreset(saveValue())}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function TheChatSettingsDrawer() {
	const location = useLocation();
	const selectedProviderId = () =>
		chatSettings().mapOr('Invalid Settings', (settings) => settings.providerId);
	const selectedModelId = () =>
		chatSettings().mapOr('Invalid Settings', (settings) => settings.modelId);
	const currentSystemPrompt = () => chatSettings().mapOr('', (settings) => settings.systemPrompt);

	const [localSystemPrompt, setLocalSystemPrompt] = createWritableMemo(() => currentSystemPrompt());

	const hasUnsavedChanges = createMemo(() => localSystemPrompt() !== currentSystemPrompt());
	const providers = useQuery(() => queries.providers.all());
	const selectedProvider = useQuery(() => queries.providers.byId(selectedProviderId()));

	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const proxifyUrl = (url: string) =>
		proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url;

	const fetcher = createMemo(() => {
		const token =
			selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data.token : undefined;
		const url =
			selectedProvider.isSuccess && selectedProvider.data ?
				proxifyUrl(selectedProvider.data!.baseUrl)
			:	undefined;
		return openAiAdapter.makeFetcher(url, token);
	});

	const currentSettings = () => ({
		modelId: selectedModelId(),
		providerId: selectedProviderId(),
		systemPrompt: localSystemPrompt()
	});

	const handleApplyPreset = (settings: {
		modelId: string;
		providerId: string;
		systemPrompt: string;
	}) => {
		setLocalSystemPrompt(settings.systemPrompt);
		updateChatSettings(settings, location());
	};

	return (
		<Drawer
			closeOnOutsidePointer={false}
			initialFocusEl={document.body}
			onOpenChange={setChatSettingsDrawerOpen}
			open={chatSettingsDrawerOpen()}
			side={isMobile() ? 'top' : 'right'}
		>
			<DrawerContent class="sm:max-w-96 sm:ml-auto sm:h-full top-0 bottom-auto rounded-t-none max-sm:rounded-b-[10px] after:bottom-full after:top-0 after:h-0 mt-0 sm:rounded-l-[10px]">
				<div class="mx-auto w-full max-xs:max-w-sm h-full flex flex-col">
					<DrawerHeader>
						<DrawerTitle>Chat Settings</DrawerTitle>
						<DrawerDescription>Set your chat preferences here.</DrawerDescription>
					</DrawerHeader>
					<div class="p-4 pb-0 grow overflow-y-auto">
						<div class="flex flex-col gap-6">
							<div class="flex flex-col gap-2">
								<Label>Provider &amp; Model</Label>
								<ProviderSelector
									onChange={async (provider) => {
										updateChatSettings(
											{
												providerId: provider.id,
												modelId: provider.defaultModelIds[0]
											},
											location()
										);
									}}
									providers={providers.isSuccess ? providers.data : []}
									selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
								/>
								<ModelSelector
									fetcher={fetcher()}
									onChange={async (model) => {
										updateChatSettings(
											{
												modelId: model.id
											},
											location()
										);
									}}
									selectedModelId={selectedModelId()}
									selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
								/>
							</div>
							<TextField class="flex flex-col gap-1.5">
								<TextFieldLabel>System Prompt</TextFieldLabel>
								<TextFieldTextArea
									onInput={(e) => setLocalSystemPrompt(e.currentTarget.value)}
									placeholder="You are a helpful AI assistant..."
									rows={4}
									value={localSystemPrompt()}
								/>
							</TextField>
						</div>
					</div>
					<DrawerFooter>
						<PresetsSection currentSettings={currentSettings} onApplyPreset={handleApplyPreset} />
						<Button
							disabled={!hasUnsavedChanges()}
							onClick={() => {
								updateChatSettings({ systemPrompt: localSystemPrompt() }, location());
							}}
						>
							{hasUnsavedChanges() ? 'Save Changes' : 'Saved'}
						</Button>
						<DrawerClose as={Button<'button'>} variant="outline">
							<span class="icon-[heroicons--x-mark-16-solid]" />
							<span>Close</span>
						</DrawerClose>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
export { chatSettingsDrawerOpen, setChatSettingsDrawerOpen };
export default TheChatSettingsDrawer;
