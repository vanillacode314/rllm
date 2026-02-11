import { nanoid } from 'nanoid';
import { createSignal, For, Show } from 'solid-js';
import { produce } from 'solid-js/store';
import * as z from 'zod/mini';

import ValidationErrors from '~/components/form/ValidationErrors';
import ProviderTestResult from '~/components/ProviderTestResult';
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
import { testProvider, type TestProviderResult } from '~/lib/providers/utils';
import { createForm, parseFormErrors } from '~/utils/form';

const [open, setOpen] = createSignal(false);
const [testResult, setTestResult] = createSignal<null | TestProviderResult>(null);
const [isTesting, setIsTesting] = createSignal(false);

const formSchema = z.object({
  name: z.string().check(z.minLength(3, { error: 'must be atleast 3 characters long' })),
  type: z.literal('openai'),
  baseUrl: z.url(),
  token: z.string().check(z.minLength(1, { error: 'invalid token' })),
  defaultModelIds: z
    .array(z.string().check(z.minLength(1)))
    .check(z.minLength(1, 'must have at least one default model'))
});

export function AddProviderModal() {
  const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
    formSchema,
    () => ({
      baseUrl: '',
      name: '',
      token: '',
      type: 'openai' as const,
      defaultModelIds: []
    })
  );

  async function handleTest() {
    resetFormErrors();
    const parsedForm = formSchema.safeParse(form);
    if (!parsedForm.success) {
      setFormErrors(parseFormErrors(parsedForm.error));
      return;
    }
    setTestResult(null);
    setIsTesting(true);

    const result = await testProvider({ baseUrl: form.baseUrl, token: form.token });
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
      type: 'createProvider',
      data: { id: nanoid(), ...parsedForm.data }
    });
    setOpen(false);
  }

  return (
    <Dialog
      modal
      onOpenChange={(value) => {
        setOpen(value);
        resetForm();
        setTestResult(null);
        resetFormErrors();
      }}
      open={open()}
    >
      <DialogContent class="sm:max-w-135">
        <form class="grid gap-4 py-4" onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Add provider</DialogTitle>
            <DialogDescription>
              Add an LLM provider here (e.g. openai, openrouter, groq, etc...)
            </DialogDescription>
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
            <TextFieldLabel class="text-right">Base URL</TextFieldLabel>
            <TextFieldInput
              name="baseUrl"
              onInput={(e) => {
                setForm('baseUrl', e.currentTarget.value);
                setTestResult(null);
              }}
              type="text"
              value={form.baseUrl}
            />
            <ValidationErrors class="col-start-2 col-end-3" errors={formErrors.baseUrl} />
          </TextField>
          <TextField class="grid grid-cols-[50px_1fr] items-center gap-x-4 gap-y-1.5">
            <TextFieldLabel class="text-right">Token</TextFieldLabel>
            <TextFieldInput
              name="token"
              onInput={(e) => {
                setForm('token', e.currentTarget.value);
                setTestResult(null);
              }}
              type="password"
              value={form.token}
            />
            <ValidationErrors class="col-start-2 col-end-3" errors={formErrors.token} />
          </TextField>
          <TextField class="grid grid-cols-[50px_1fr] items-center gap-x-4 gap-y-1.5">
            <TextFieldLabel class="text-right">Default Models</TextFieldLabel>
            <TextFieldInput
              name="defaultModelIds"
              onBlur={(event) => {
                if (event.currentTarget.value.trim().length > 0) {
                  setForm(produce((form) => form.defaultModelIds.push(event.currentTarget.value)));
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
            <div class="col-start-2 col-end-3 flex flex-wrap gap-2">
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
            <ValidationErrors class="col-start-2 col-end-3" errors={formErrors.defaultModelIds} />
          </TextField>
          <Show when={testResult()}>
            <ProviderTestResult onRetry={handleTest} result={testResult()!} />
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

export default AddProviderModal;

export { open as addProviderModelOpen, setOpen as setAddProviderModalOpen };
