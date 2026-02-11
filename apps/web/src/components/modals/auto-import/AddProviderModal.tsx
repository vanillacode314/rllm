import { type } from 'arktype';
import { nanoid } from 'nanoid';
import { createSignal, For } from 'solid-js';

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
import { createForm, parseFormErrors } from '~/utils/form';

const [open, setOpen] = createSignal(false);

const formSchema = type({
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

export function AddProviderModal() {
	const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
		formSchema,
		() => ({
			baseUrl: '',
			name: '',
			token: '',
			type: 'openai',
			defaultModelIds: []
		})
	);

	return (
		<Dialog
			modal
			onOpenChange={(value) => {
				setOpen(value);
				resetForm();
			}}
			open={open()}
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
							type: 'createProvider',
							data: { id: nanoid(), ...parsedFormData }
						});
						setOpen(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add provider</DialogTitle>
						<DialogDescription>
							Add an LLM provider here (e.g. openai, openrouter, groq, etc...)
						</DialogDescription>
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
										event.currentTarget.value
									);
									event.currentTarget.value = '';
								}
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									setForm(
										'defaultModelIds',
										form.defaultModelIds.length,
										event.currentTarget.value
									);
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
							<span>Add</span>
							<span class="icon-[heroicons--plus]" />
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default AddProviderModal;

export { open as addProviderModelOpen, setOpen as setAddProviderModalOpen };
