import { useQuery } from '@tanstack/solid-query';
import { createRenderEffect, createSignal, Show } from 'solid-js';
import * as z from 'zod/mini';

import ValidationErrors from '~/components/form/ValidationErrors';
import MCPTestResult from '~/components/MCPTestResult';
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
import { testMCPServer, type TestMCPServerResult } from '~/lib/mcp/utils';
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

const [mcpIdToEdit, setMcpIdToEdit] = createSignal<false | string>(false);
const [testResult, setTestResult] = createSignal<null | TestMCPServerResult>(null);
const [isTesting, setIsTesting] = createSignal(false);

const formSchema = z.object({
  id: z.string(),
  name: z.string().check(z.minLength(3, { error: 'must be atleast 3 characters long' })),
  url: z.url()
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

  createRenderEffect(() => {
    if (!mcpQuery.data) return;
    setForm(mcpQuery.data);
    resetFormErrors();
  });

  async function handleTest() {
    resetFormErrors();
    const parsedForm = formSchema.safeParse(form);
    if (!parsedForm.success) {
      setFormErrors(parseFormErrors(parsedForm.error));
      return;
    }
    setTestResult(null);
    setIsTesting(true);

    const result = await testMCPServer({ name: form.name, url: form.url });
    setTestResult(result);
    setIsTesting(false);
  }

  function handleSave(event: Event) {
    event.preventDefault();
    resetFormErrors();

    const parsedForm = formSchema.safeParse(form);
    if (!parsedForm.success) {
      setFormErrors(parseFormErrors(parsedForm.error));
      return;
    }

    logger.dispatch({
      type: 'updateMcp',
      data: parsedForm.data
    });
    setMcpIdToEdit(false);
  }

  return (
    <Dialog
      modal
      onOpenChange={(value) => {
        if (!value) {
          setMcpIdToEdit(false);
          resetForm();
          resetFormErrors();
          setTestResult(null);
        }
      }}
      open={!!mcpIdToEdit()}
    >
      <DialogContent class="sm:max-w-135">
        <form class="grid gap-4 py-4" onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit MCP</DialogTitle>
            <DialogDescription>Edit MCP in the system</DialogDescription>
          </DialogHeader>
          <TextField class="grid grid-cols-[50px_1fr] items-center gap-x-4 gap-y-1.5">
            <TextFieldLabel class="text-right">Name</TextFieldLabel>
            <TextFieldInput
              name="name"
              onInput={(e) => {
                setForm('name', e.currentTarget.value);
                setTestResult(null);
              }}
              type="text"
              value={form.name}
            />
            <ValidationErrors class="col-start-2 col-end-3" errors={formErrors.name} />
          </TextField>
          <TextField class="grid grid-cols-[50px_1fr] items-center gap-x-4 gap-y-1.5">
            <TextFieldLabel class="text-right">URL</TextFieldLabel>
            <TextFieldInput
              name="url"
              onInput={(e) => {
                setForm('url', e.currentTarget.value);
                setTestResult(null);
              }}
              type="text"
              value={form.url}
            />
            <ValidationErrors class="col-start-2 col-end-3" errors={formErrors.url} />
          </TextField>
          <Show when={testResult()}>
            <MCPTestResult onRetry={handleTest} result={testResult()!} />
          </Show>
          <DialogFooter>
            <Show
              fallback={
                <Button disabled={isTesting()} onClick={handleTest} type="button">
                  <span>{isTesting() ? 'Testing...' : 'Test'}</span>
                  {!isTesting() && <span class="icon-[heroicons--sparkles]" />}
                </Button>
              }
              when={testResult()}
            >
              <Show
                fallback={
                  <Button disabled={isTesting()} onClick={handleTest} type="button">
                    <span>{isTesting() ? 'Testing...' : 'Retry'}</span>
                    {!isTesting() && <span class="icon-[heroicons--arrow-path]" />}
                  </Button>
                }
                when={testResult()!.success}
              >
                <Button type="submit">
                  <span>Save</span>
                  <span class="icon-[heroicons--check-circle-solid]" />
                </Button>
              </Show>
            </Show>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditMCPModal;

export { mcpIdToEdit as editMCPModalOpen, setMcpIdToEdit as setEditMCPModalOpen };
