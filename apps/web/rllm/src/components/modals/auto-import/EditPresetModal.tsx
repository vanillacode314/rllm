import { useQuery } from '@tanstack/solid-query';
import { createMemo, createRenderEffect, createSignal, untrack } from 'solid-js';
import * as z from 'zod/mini';

import type { TChatSettings } from '~/lib/chat/settings';

import ValidationErrors from '~/components/form/ValidationErrors';
import ModelSelector from '~/components/ModelSelector';
import ProviderSelector from '~/components/ProviderSelector';
import { Button } from 'ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'ui/dialog';
import { Label } from 'ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'ui/select';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from 'ui/switch';
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea
} from 'ui/text-field';
import { REASONING_VALUE_TO_LABEL_MAP } from '~/constants/chat-settings';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { updatePreset } from '~/lib/chat/presets';
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';

export const [editPresetModalOpen, setEditPresetModalOpen] = createSignal<false | string>(false);

const formSchema = z.object({
  includeDateTimeInSystemPrompt: z._default(z.boolean(), true),
  modelId: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  providerId: z.string().check(z.minLength(1)),
  reasoning: z._default(z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']), 'medium'),
  systemPrompt: z.string()
});

export function EditPresetModal() {
  const presetId = () => editPresetModalOpen() || '';

  const presetQuery = useQuery(() => ({
    enabled: editPresetModalOpen() !== false,
    ...queries.chatPresets.byId(presetId())
  }));

  const providers = useQuery(() => queries.providers.all());

  const [{ form, formErrors }, { resetForm, resetFormErrors, setForm, setFormErrors }] = createForm(
    formSchema,
    () =>
      presetQuery.data
        ? formSchema.parse({
            includeDateTimeInSystemPrompt: presetQuery.data.settings.includeDateTimeInSystemPrompt,
            modelId: presetQuery.data.settings.modelId,
            name: presetQuery.data.name,
            providerId: presetQuery.data.settings.providerId,
            reasoning: presetQuery.data.settings.reasoning,
            systemPrompt: presetQuery.data.settings.systemPrompt
          })
        : {
            includeDateTimeInSystemPrompt: true,
            modelId: '',
            name: '',
            providerId: '',
            reasoning: 'medium' as const,
            systemPrompt: ''
          }
  );

  const selectedProviderQuery = useQuery(() => ({
    enabled: form.providerId !== '',
    ...queries.providers.byId(form.providerId)
  }));

  const adapter = createMemo(() => {
    const provider = selectedProviderQuery.data;
    if (!provider) return null;
    const token = provider.token;
    const url = provider.baseUrl;
    return new OpenAIAdapter(url, token);
  });

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
                includeDateTimeInSystemPrompt: parsedForm.data.includeDateTimeInSystemPrompt,
                modelId: parsedForm.data.modelId,
                providerId: parsedForm.data.providerId,
                reasoning: parsedForm.data.reasoning,
                systemPrompt: parsedForm.data.systemPrompt
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
