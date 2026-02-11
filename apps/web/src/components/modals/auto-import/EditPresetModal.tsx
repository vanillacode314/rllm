import { useQuery } from '@tanstack/solid-query';
import { type } from 'arktype';
import { createEffect, createMemo, createSignal, untrack } from 'solid-js';

import ValidationErrors from '~/components/form/ValidationErrors';
import ModelSelector from '~/components/ModelSelector';
import ProviderSelector from '~/components/ProviderSelector';
import { Button } from '~/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea
} from '~/components/ui/text-field';
import { openAiAdapter } from '~/lib/adapters/openai';
import { updatePreset } from '~/lib/chat/presets';
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

export const [editPresetModalOpen, setEditPresetModalOpen] = createSignal<false | string>(false);

const formSchema = type({
	name: 'string > 0',
	providerId: 'string > 0',
	modelId: 'string > 0',
	systemPrompt: 'string'
});

export function EditPresetModal() {
	const presetId = () => editPresetModalOpen() || '';

	const presetQuery = useQuery(() => ({
		enabled: editPresetModalOpen() !== false,
		...queries.chatPresets.byId(presetId())
	}));

	const selectedProviderQuery = useQuery(() => ({
		enabled: presetQuery.isSuccess && !!presetQuery.data,
		...queries.providers.byId(presetQuery.data?.settings.providerId || '')
	}));

	const proxyUrlQuery = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const proxifyUrl = (url: string) =>
		proxyUrlQuery.isSuccess && proxyUrlQuery.data ? proxyUrlQuery.data.replace('%s', url) : url;

	const providers = useQuery(() => queries.providers.all());

	const fetcher = createMemo(() => {
		const provider = selectedProviderQuery.data;
		if (!provider) return openAiAdapter.makeFetcher();
		const token = provider.token;
		const url = proxifyUrl(provider.baseUrl);
		return openAiAdapter.makeFetcher(url, token);
	});

	const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
		formSchema,
		() => ({
			name: '',
			providerId: '',
			modelId: '',
			systemPrompt: ''
		})
	);

	createEffect(() => {
		if (!presetQuery.data) return;

		untrack(() => {
			setForm({
				name: presetQuery.data.name,
				providerId: presetQuery.data.settings.providerId,
				modelId: presetQuery.data.settings.modelId,
				systemPrompt: presetQuery.data.settings.systemPrompt
			});
			resetFormErrors();
		});
	});

	return (
		<Dialog
			modal
			onOpenChange={(value) => {
				if (!value) {
					setEditPresetModalOpen(false);
					resetForm();
				}
			}}
			open={!!editPresetModalOpen()}
		>
			<DialogContent class="sm:max-w-[425px]">
				<form
					class="grid gap-4 py-4"
					onSubmit={async (event) => {
						event.preventDefault();
						resetFormErrors();
						const parsedFormData = formSchema(form);
						if (parsedFormData instanceof type.errors) {
							setFormErrors(parseFormErrors(parsedFormData));
							return;
						}
						const presetId = editPresetModalOpen();
						if (!presetId) return;
						await updatePreset(presetId, {
							name: parsedFormData.name,
							settings: {
								providerId: parsedFormData.providerId,
								modelId: parsedFormData.modelId,
								systemPrompt: parsedFormData.systemPrompt
							}
						});
						setEditPresetModalOpen(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Edit Preset</DialogTitle>
						<DialogDescription>Edit an existing chat preset</DialogDescription>
					</DialogHeader>
					<TextField class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<TextFieldLabel class="text-right">Name</TextFieldLabel>
						<TextFieldInput
							class="col-span-3"
							name="name"
							onInput={(e) => setForm('name', e.currentTarget.value)}
							type="text"
							value={form.name}
						/>
						<ValidationErrors class="col-start-2 col-end-5" errors={formErrors.name} />
					</TextField>
					<div class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<Label class="text-right">Provider</Label>
						<div class="col-span-3">
							<ProviderSelector
								onChange={(provider) => {
									setForm('providerId', provider.id);
									setForm('modelId', provider.defaultModelIds[0]);
								}}
								providers={providers.isSuccess ? providers.data : []}
								selectedProvider={
									selectedProviderQuery.isSuccess ? (selectedProviderQuery.data ?? null) : null
								}
							/>
						</div>
					</div>
					<div class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<Label class="text-right">Model</Label>
						<div class="col-span-3">
							<ModelSelector
								fetcher={fetcher()}
								onChange={(model) => setForm('modelId', model.id)}
								selectedModelId={form.modelId}
								selectedProvider={
									selectedProviderQuery.isSuccess ? (selectedProviderQuery.data ?? null) : null
								}
							/>
						</div>
					</div>
					<TextField class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<TextFieldLabel class="text-right">System Prompt</TextFieldLabel>
						<TextFieldTextArea
							class="col-span-3"
							name="systemPrompt"
							onInput={(e) => setForm('systemPrompt', e.currentTarget.value)}
							rows={4}
							value={form.systemPrompt}
						/>
						<ValidationErrors class="col-start-2 col-end-5" errors={formErrors.systemPrompt} />
					</TextField>
					<DialogFooter>
						<Button type="submit">
							<span>Save Changes</span>
							<span class="icon-[heroicons--pencil-square]" />
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default EditPresetModal;
