import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { createMemo } from 'solid-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'ui/select';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from 'ui/switch';

import { STARTUP_PAGE_OPTIONS, type TStartupPage } from '~/constants/settings';
import { db } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/general')({
  component: SettingsGeneralComponent,
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(queries.userMetadata.startupPage()),
      queryClient.ensureQueryData(queries.userMetadata.hideReasoningDuringGeneration()),
      queryClient.ensureQueryData(queries.userMetadata.webSearchMcpId()),
      queryClient.ensureQueryData(queries.mcps.all())
    ]);
  }
});

function SettingsGeneralComponent() {
  const startupPage = useQuery(queries.userMetadata.startupPage);
  const hideReasoningDuringGeneration = useQuery(
    queries.userMetadata.hideReasoningDuringGeneration
  );
  const webSearchMcpId = useQuery(queries.userMetadata.webSearchMcpId);
  const mcps = useQuery(queries.mcps.all);

  async function updateStartupPage(value: TStartupPage) {
    await db.userMetadata.setStartupPage(value);
  }

  async function updateHideReasoningDuringGeneration(checked: boolean) {
    await db.userMetadata.setHideReasoningDuringGeneration(checked);
  }

  async function updateWebSearchMcp(value: string) {
    await db.userMetadata.setWebSearchMcpId(value);
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
              <SelectValue<ReturnType<typeof webSearchMcpOptions>[number]>>
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
            checked={hideReasoningDuringGeneration.isSuccess && hideReasoningDuringGeneration.data}
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
