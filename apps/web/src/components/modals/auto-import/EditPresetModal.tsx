import { useQuery } from '@tanstack/solid-query';
import { createMemo, createRenderEffect, createSignal, untrack } from 'solid-js';
import * as z from 'zod/mini';

import type { TChatSettings } from '~/lib/chat/settings';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from '~/components/ui/switch';
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea
} from '~/components/ui/text-field';
import { REASONING_VALUE_TO_LABEL_MAP } from '~/constants/chat-settings';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { updatePreset } from '~/lib/chat/presets';
import { ProxyManager } from '~/lib/proxy';
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

export const [editPresetModalOpen, setEditPresetModalOpen] = createSignal<false | string>(false);

const formSchema = z.object({
  name: z.string().check(z.minLength(1)),
  providerId: z.string().check(z.minLength(1)),
  modelId: z.string().check(z.minLength(1)),
  includeDateTimeInSystemPrompt: z._default(z.boolean(), true),
  systemPrompt: z.string(),
  reasoning: z._default(z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']), 'medium')
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

  const providers = useQuery(() => queries.providers.all());

  const adapter = createMemo(() => {
    const provider = selectedProviderQuery.data;
    if (!provider) return null;
    const token = provider.token;
    const url = provider.baseUrl;
    return new OpenAIAdapter(url, token);
  });

  const [{ form, formErrors }, { setFormErrors, setForm, resetForm, resetFormErrors }] = createForm(
    formSchema,
    () =>
      presetQuery.data ?
        formSchema.parse({
          name: presetQuery.data.name,
          providerId: presetQuery.data.settings.providerId,
          modelId: presetQuery.data.settings.modelId,
          systemPrompt: presetQuery.data.settings.systemPrompt,
          includeDateTimeInSystemPrompt: presetQuery.data.settings.includeDateTimeInSystemPrompt,
          reasoning: presetQuery.data.settings.reasoning
        })
      : {
          name: '',
          providerId: '',
          modelId: '',
          systemPrompt: '',
          includeDateTimeInSystemPrompt: true,
          reasoning: 'medium' as const
        }
  );

  createRenderEffect(() => {
    void presetQuery.data;
    untrack(resetForm);
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
      <DialogContent class="sm:max-w-106.25">
        <form
          class="grid gap-4 py-4"
          onSubmit={async (event) => {
            event.preventDefault();
            resetFormErrors();
            const parsedForm = formSchema.safeParse(form);
            if (!parsedForm.success) {
              setFormErrors(parseFormErrors(parsedForm.error));
              return;
            }
            const presetId = editPresetModalOpen();
            if (!presetId) return;
            await updatePreset(presetId, {
              name: parsedForm.data.name,
              settings: {
                providerId: parsedForm.data.providerId,
                modelId: parsedForm.data.modelId,
                systemPrompt: parsedForm.data.systemPrompt,
                includeDateTimeInSystemPrompt: parsedForm.data.includeDateTimeInSystemPrompt,
                reasoning: parsedForm.data.reasoning
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
                adapter={adapter()}
                onChange={(model) => setForm('modelId', model.id)}
                selectedModelId={form.modelId}
                selectedProvider={
                  selectedProviderQuery.isSuccess ? (selectedProviderQuery.data ?? null) : null
                }
              />
            </div>
          </div>
          <div class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
            <Label>Reasoning Effort</Label>
            <Select
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {REASONING_VALUE_TO_LABEL_MAP[props.item.rawValue]}
                </SelectItem>
              )}
              onChange={(value) => value && setForm('reasoning', value)}
              options={['none', 'minimal', 'low', 'medium', 'high', 'xhigh']}
              value={form.reasoning}
            >
              <SelectTrigger>
                <SelectValue<TChatSettings['reasoning']>>
                  {(state) => REASONING_VALUE_TO_LABEL_MAP[state.selectedOption()]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
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
          <div class="grid grid-cols-4 items-center gap-x-4 gap-y-1.5">
            <Label class="text-right">Include Date/Time</Label>
            <div class="col-span-3">
              <Switch
                checked={form.includeDateTimeInSystemPrompt}
                class="flex items-center space-x-2"
                id="includeDateTimeInSystemPrompt"
                onChange={(checked) => setForm('includeDateTimeInSystemPrompt', checked)}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel>Include current date/time in system prompt</SwitchLabel>
              </Switch>
            </div>
          </div>
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
