import { useQuery } from '@tanstack/solid-query';
import { createRenderEffect, createSignal, For, Show } from 'solid-js';
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
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

const [providerIdToEdit, setProviderIdToEdit] = createSignal<false | string>(false);
const [testResult, setTestResult] = createSignal<null | TestProviderResult>(null);
const [isTesting, setIsTesting] = createSignal(false);

const formSchema = z.object({
  id: z.string(),
  name: z.string().check(z.minLength(3, { error: 'must be atleast 3 characters long' })),
  type: z.literal('openai'),
  baseUrl: z.url(),
  token: z.string().check(z.minLength(1, { error: 'invalid token' })),
  defaultModelIds: z
    .array(z.string().check(z.minLength(1)))
    .check(z.minLength(1, 'must have at least one default model'))
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
      type: 'openai' as const,
      defaultModelIds: []
    })
  );

  createRenderEffect(() => {
    if (!providerQuery.data) return;

    setForm(providerQuery.data);
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

    const result = await testProvider({ baseUrl: form.baseUrl, token: form.token });
    setTestResult(result);
    setIsTesting(false);
  }

  function handleSave(event: SubmitEvent) {
    event.preventDefault();
    resetFormErrors();

    const parsedForm = formSchema.safeParse(form);
    if (!parsedForm.success) {
      setFormErrors(parseFormErrors(parsedForm.error));
      return;
    }

    logger.dispatch({
      type: 'updateProvider',
      data: parsedForm.data
    });
    setProviderIdToEdit(false);
  }

  return (
    <Dialog
      modal
      onOpenChange={(value) => {
        if (!value) {
          setProviderIdToEdit(false);
          resetForm();
          setTestResult(null);
          resetFormErrors();
        }
      }}
      open={!!providerIdToEdit()}
    >
      <DialogContent class="sm:max-w-135">
        <form class="grid gap-4 py-4" onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit provider</DialogTitle>
            <DialogDescription>Edit an LLM provider</DialogDescription>
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

export default EditProviderModal;

export {
  providerIdToEdit as editProviderModalOpen,
  setProviderIdToEdit as setEditProviderModalOpen
};
