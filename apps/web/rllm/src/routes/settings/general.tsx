import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';
import { Label } from 'ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'ui/select';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from 'ui/switch';

import { STARTUP_PAGE_OPTIONS, type TStartupPage } from '~/constants/settings';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/general')({
  component: SettingsGeneralComponent,
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(queries.userMetadata.byId(USER_METADATA_KEYS.STARTUP_PAGE)),
      queryClient.ensureQueryData(
        queries.userMetadata.byId(USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION)
      )
    ]);
  }
});

function SettingsGeneralComponent() {
  const startupPage = useQuery(() => queries.userMetadata.byId(USER_METADATA_KEYS.STARTUP_PAGE));
  const hideReasoningDuringGeneration = useQuery(() =>
    queries.userMetadata.byId(USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION)
  );

  async function updateStartupPage(value: TStartupPage) {
    await logger.dispatch({
      data: {
        id: USER_METADATA_KEYS.STARTUP_PAGE,
        value
      },
      type: 'setUserMetadata'
    });
  }

  async function updateHideReasoningDuringGeneration(checked: boolean) {
    await logger.dispatch({
      data: {
        id: USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION,
        value: String(checked)
      },
      type: 'setUserMetadata'
    });
  }

  return (
    <div class="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Startup Page</CardTitle>
          <CardDescription>Choose which page opens when you launch the app.</CardDescription>
        </CardHeader>
        <CardContent class="md:flex">
          <Select
            class="min-w-54"
            defaultValue={STARTUP_PAGE_OPTIONS.find(
              (option) =>
                option.value ===
                (startupPage.isSuccess && startupPage.data ? startupPage.data : 'new-chat')
            )}
            itemComponent={(props) => (
              <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
            )}
            onChange={(value) => {
              if (!value) return;
              updateStartupPage(value.value);
            }}
            options={STARTUP_PAGE_OPTIONS}
            optionTextValue="label"
            optionValue="value"
          >
            <SelectTrigger aria-label="Startup Page">
              <SelectValue<(typeof STARTUP_PAGE_OPTIONS)[number]>>
                {(state) => state.selectedOption().label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chat Settings</CardTitle>
          <CardDescription>Customize chat settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Switch
            checked={hideReasoningDuringGeneration.data !== 'false'}
            class="flex items-center space-x-2"
            id="hideReasoningDuringGeneration"
            onChange={(checked) => updateHideReasoningDuringGeneration(checked)}
          >
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
            <SwitchLabel>Hide Reasoning During Generation</SwitchLabel>
          </Switch>
        </CardContent>
      </Card>
    </div>
  );
}
