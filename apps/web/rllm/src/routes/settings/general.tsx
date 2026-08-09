import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { createMemo } from 'solid-js';
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
      ),
      queryClient.ensureQueryData(queries.userMetadata.byId(USER_METADATA_KEYS.WEB_SEARCH_MCP_ID)),
      queryClient.ensureQueryData(queries.mcps.all())
    ]);
  }
});

function SettingsGeneralComponent() {
  const startupPage = useQuery(() => queries.userMetadata.byId(USER_METADATA_KEYS.STARTUP_PAGE));
  const hideReasoningDuringGeneration = useQuery(() =>
    queries.userMetadata.byId(USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION)
  );
  const webSearchMcpId = useQuery(() =>
    queries.userMetadata.byId(USER_METADATA_KEYS.WEB_SEARCH_MCP_ID)
  );
  const mcps = useQuery(queries.mcps.all);

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

  async function updateWebSearchMcp(value: string) {
    await logger.dispatch({
      data: {
        id: USER_METADATA_KEYS.WEB_SEARCH_MCP_ID,
        value
      },
      type: 'setUserMetadata'
    });
  }

  const webSearchMcpOptions = createMemo(
    () =>
      [
        { label: 'None', value: 'none' },
        ...(mcps.data ?? []).map((mcp) => ({ label: mcp.name, value: mcp.id }))
      ] satisfies Array<{ label: string; value: string }>
  );

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
          <CardTitle>Web Search MCP</CardTitle>
          <CardDescription>
            Choose the MCP server used for web search. This enables enhances features like
            citations.
          </CardDescription>
        </CardHeader>
        <CardContent class="md:flex">
          <Select
            class="min-w-54"
            defaultValue={webSearchMcpOptions().find(
              (option) =>
                option.value ===
                (webSearchMcpId.isSuccess && webSearchMcpId.data !== null
                  ? webSearchMcpId.data
                  : 'none')
            )}
            itemComponent={(props) => (
              <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
            )}
            onChange={(value) => {
              if (!value) return;
              updateWebSearchMcp(value.value);
            }}
            options={webSearchMcpOptions()}
            optionTextValue="label"
            optionValue="value"
          >
            <SelectTrigger aria-label="Web Search MCP">
              <SelectValue>{(state) => state.selectedOption().label}</SelectValue>
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
