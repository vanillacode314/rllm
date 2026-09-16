import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, redirect } from '@tanstack/solid-router';
import { createMemo, Show } from 'solid-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';
import { Label } from 'ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'ui/select';

import { ModelSelector } from '~/components/ModelSelector';
import { CURRENT_MODEL_ID } from '~/constants/chat-settings';
import { db } from '~/db/client';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/models')({
  beforeLoad: async () => {
    const providers = await queryClient.ensureQueryData(queries.providers.all());
    if (providers.length === 0) return redirect({ to: '/settings/providers' });
  },
  component: SettingsModelComponent,
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(queries.userMetadata.titleGenerationProviderId()),
      queryClient.ensureQueryData(queries.userMetadata.titleGenerationModelId())
    ]);
  }
});

function SettingsModelComponent() {
  const providers = useQuery(queries.providers.all);
  const titleGenerationProviderId = useQuery(queries.userMetadata.titleGenerationProviderId);
  const provider = useQuery(() => ({
    enabled:
      titleGenerationProviderId.isSuccess && titleGenerationProviderId.data !== CURRENT_MODEL_ID,
    ...queries.providers.get(titleGenerationProviderId.data ?? '')
  }));

  const adapter = createMemo(() => {
    const token = provider.isSuccess ? provider.data?.token : undefined;
    if (!token) return null;
    const url = provider.isSuccess ? provider.data?.baseUrl : undefined;
    if (!url) return null;
    return new OpenAIAdapter(url, token);
  });

  const titleGenerationModelId = useQuery(queries.userMetadata.titleGenerationModelId);

  const options = createMemo(() => {
    const opts = [{ label: 'Current Model', value: CURRENT_MODEL_ID }];
    for (const provider of providers.data ?? [])
      opts.push({ label: provider.name, value: provider.id });
    return opts;
  });

  async function updateTitleGenerationProvider(providerId: string) {
    await db.userMetadata.setTitleGeneration(providerId);
  }

  async function updateTitleGenerationModel(modelId: string) {
    await db.userMetadata.setTitleGenerationModelId(modelId);
  }

  return (
    <div class="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Title &amp; Tags Generation</CardTitle>
          <CardDescription>
            Customize what model is used for title and tags generation.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <div class="flex gap-2 items-center">
            <Label>Provider: </Label>
            <Select
              defaultValue={options().find((opt) => opt.value === titleGenerationProviderId.data)}
              itemComponent={(props) => (
                <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
              )}
              onChange={(value) => {
                if (!value) return;
                updateTitleGenerationProvider(value.value);
              }}
              options={options()}
              optionTextValue="label"
              optionValue="value"
            >
              <SelectTrigger aria-label="Title Generation Model">
                <SelectValue<ReturnType<typeof options>[number]>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
          <Show when={provider.isSuccess && provider.data}>
            <div class="flex gap-2 items-center">
              <Label>Model: </Label>
              <ModelSelector
                adapter={adapter()}
                onChange={(model) => updateTitleGenerationModel(model.id)}
                selectedModelId={titleGenerationModelId.data ?? null}
                selectedProvider={provider.data ?? null}
              />
            </div>
          </Show>
        </CardContent>
      </Card>
    </div>
  );
}
