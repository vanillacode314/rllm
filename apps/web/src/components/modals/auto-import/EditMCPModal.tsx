import { useQuery } from '@tanstack/solid-query';
import { type } from 'arktype';
import { createEffect, createSignal } from 'solid-js';

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
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

const [mcpIdToEdit, setMcpIdToEdit] = createSignal<false | string>(false);

const formSchema = type({
	id: 'string',
	name: 'string > 0',
	url: 'string.url'
});

export function EditMCPModal() {
	const mcpQuery = useQuery(() => ({
		enabled: !!mcpIdToEdit(),
		...queries.mcps.byId(mcpIdToEdit() || '')
	}));

	const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
		formSchema,
		() => ({
			id: '',
			name: '',
			url: ''
		})
	);

	createEffect(() => {
		if (!mcpQuery.data) return;

		setForm(mcpQuery.data);
		resetFormErrors();
	});

	return (
		<Dialog
			modal
			onOpenChange={(value) => {
				if (!value) {
					setMcpIdToEdit(false);
					resetForm();
				}
			}}
			open={!!mcpIdToEdit()}
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
							user_intent: 'update_mcp',
							meta: parsedFormData
						});
						setMcpIdToEdit(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Edit MCP</DialogTitle>
						<DialogDescription>Edit MCP in the system</DialogDescription>
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
							<span>Save Changes</span>
							<span class="icon-[heroicons--pencil-square]" />
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default EditMCPModal;

export { mcpIdToEdit as editMCPModalOpen, setMcpIdToEdit as setEditMCPModalOpen };
