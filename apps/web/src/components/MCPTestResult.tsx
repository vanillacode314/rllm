import { createSignal, Show } from 'solid-js';

import type { TestMCPServerResult } from '~/lib/mcp/utils';
import type { TTool } from '~/types';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader } from './ui/card';

interface MCPTestResultProps {
  onRetry: () => void;
  result: TestMCPServerResult;
}

export function MCPTestResult(props: MCPTestResultProps) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <Show
      fallback={
        <Alert variant="destructive">
          <AlertTitle class="flex flex-wrap items-center gap-2">
            <span class="icon-[heroicons--x-circle-solid] size-5 shrink-0" />
            <span>Connection Failed</span>
            <Badge round variant="error">
              Error
            </Badge>
          </AlertTitle>
          <AlertDescription class="mt-2">{props.result.error}</AlertDescription>
        </Alert>
      }
      when={props.result.success}
    >
      <Card class="border-success/80 bg-success/20">
        <CardHeader class="flex flex-row gap-3 items-start p-3 pb-0">
          <span class="icon-[heroicons--check-circle-solid] size-5 text-success" />

          <Show when={props.result.serverInfo}>
            <div class="text-sm text-muted-foreground flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium text-foreground">{props.result.serverInfo!.name}</span>
              <Show when={props.result.serverInfo!.version}>
                <span>•</span>
                <span>v{props.result.serverInfo!.version}</span>
              </Show>
            </div>
          </Show>
        </CardHeader>
        <CardContent class="p-3 pt-0">
          <Show when={props.result.tools && props.result.tools.length > 0}>
            <div class="mt-3">
              <button
                class="group flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
                onClick={() => setExpanded(!expanded())}
                type="button"
              >
                <span
                  class="h-4 w-4 transition-transform"
                  classList={{
                    'icon-[heroicons--chevron-down-solid]': expanded(),
                    'icon-[heroicons--chevron-right-solid]': !expanded()
                  }}
                />
                <span>
                  {props.result.tools!.length} tool
                  {props.result.tools!.length > 1 ? 's' : ''} available
                </span>
              </button>

              <Show when={expanded()}>
                <div class="mt-3 space-y-2">
                  {props.result.tools!.map((tool: TTool) => (
                    <Alert>
                      <div class="flex items-start gap-2">
                        <span class="icon-[heroicons--cube-solid] mt-0.5 h-4 w-4 text-foreground" />
                        <div class="min-w-0 flex-1">
                          <AlertTitle>{tool.name}</AlertTitle>
                          <Show when={tool.description}>
                            <AlertDescription>{tool.description}</AlertDescription>
                          </Show>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              </Show>
            </div>
          </Show>
        </CardContent>
      </Card>
    </Show>
  );
}

export default MCPTestResult;
