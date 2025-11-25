import { useQuery } from '@tanstack/solid-query';
import { type } from 'arktype';
import { createEffect, createSignal, For } from 'solid-js';

import ValidationErrors from '~/components/form/ValidationErrors';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '~/components/ui/dialog';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

const [providerIdToEdit, setProviderIdToEdit] = createSignal<false | string>(false);

const formSchema = type({
	id: 'string', // Provider ID is required for editing
	name: 'string > 0',
	type: '"openai"',
	baseUrl: type('string.url').configure({
		problem: () => 'must be a url'
	}),
	token: 'string',
	defaultModelIds: type('(string > 0)[] > 0').configure({
		problem: () => 'must have at least one default model'
	})
});

export function EditProviderModal() {
	const providerQuery = useQuery(() => ({
		enabled: !!providerIdToEdit(),
		...queries.providers.byId(providerIdToEdit() || '')
	}));

	const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
		formSchema,
		() => ({
			id: '',
			baseUrl: '',
			name: '',
			token: '',
			type: 'openai',
			defaultModelIds: []
		})
	);

	createEffect(() => {
		if (!providerQuery.data) return;

		setForm(providerQuery.data);
		resetFormErrors();
	});

	return (
		<Dialog
			modal
			onOpenChange={(value) => {
				if (!value) {
					setProviderIdToEdit(false);
					resetForm();
				}
			}}
			open={!!providerIdToEdit()}
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
						await logger.dispatch({
							type: 'update_provider',
							data: parsedFormData
						});
						setProviderIdToEdit(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Edit provider</DialogTitle>
						<DialogDescription>Edit an LLM provider</DialogDescription>
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
					<TextField class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<TextFieldLabel class="text-right">Base URL</TextFieldLabel>
						<TextFieldInput
							class="col-span-3"
							name="baseUrl"
							onInput={(e) => setForm('baseUrl', e.currentTarget.value)}
							type="text"
							value={form.baseUrl}
						/>
						<ValidationErrors class="col-start-2 col-end-5" errors={formErrors.baseUrl} />
					</TextField>
					<TextField class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<TextFieldLabel class="text-right">Token</TextFieldLabel>
						<TextFieldInput
							class="col-span-3"
							name="token"
							onInput={(e) => setForm('token', e.currentTarget.value)}
							type="password"
							value={form.token}
						/>
						<ValidationErrors class="col-start-2 col-end-5" errors={formErrors.token} />
					</TextField>
					<TextField class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
						<TextFieldLabel class="text-right">Default Models</TextFieldLabel>
						<TextFieldInput
							class="col-span-3"
							name="defaultModelIds"
							onBlur={(event) => {
								if (event.currentTarget.value.trim().length > 0) {
									setForm(
										'defaultModelIds',
										form.defaultModelIds.length,
										event.currentTarget.value.trim()
									);
									event.currentTarget.value = '';
								}
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									const newValue = event.currentTarget.value.trim();
									if (newValue && !form.defaultModelIds.includes(newValue)) {
										setForm('defaultModelIds', form.defaultModelIds.length, newValue);
									}
									event.currentTarget.value = '';
								}
							}}
							type="text"
						/>
						<div class="col-start-2 col-end-5 flex flex-wrap gap-2">
							<For each={form.defaultModelIds}>
								{(id, index) => (
									<Badge>
										{id}
										<button
											class="ml-1 text-xs text-muted-foreground hover:text-foreground"
											onClick={() => {
												const newModels = form.defaultModelIds.filter((_, i) => i !== index());
												setForm('defaultModelIds', newModels);
											}}
											type="button"
										>
											&times;
										</button>
									</Badge>
								)}
							</For>
						</div>
						<ValidationErrors class="col-start-2 col-end-5" errors={formErrors.defaultModelIds} />
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

export default EditProviderModal;

export {
	providerIdToEdit as editProviderModalOpen,
	setProviderIdToEdit as setEditProviderModalOpen
};
