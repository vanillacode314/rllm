import { type } from 'arktype';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';

import ValidationErrors from '~/components/form/ValidationErrors';
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
	url: 'string.url'
});

export function AddMCPModal() {
	const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
		formSchema,
		() => ({
			name: '',
			url: ''
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
							user_intent: 'add_mcp',
							meta: { id: nanoid(), ...parsedFormData }
						});
						setOpen(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add MCP</DialogTitle>
						<DialogDescription>Add a new MCP to the system.</DialogDescription>
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
						<TextFieldLabel class="text-right">URL</TextFieldLabel>
						<TextFieldInput
							class="col-span-3"
							name="url"
							onInput={(e) => setForm('url', e.currentTarget.value)}
							type="text"
							value={form.url}
						/>
						<ValidationErrors class="col-start-2 col-end-5" errors={formErrors.url} />
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

export default AddMCPModal;

export { open as addMCPModelOpen, setOpen as setAddMCPModalOpen };
