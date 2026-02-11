import { createVirtualizer } from '@tanstack/solid-virtual';
import { createMemo, createSignal, For, Show } from 'solid-js';

import type { TestProviderResult } from '~/lib/providers/utils';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';

interface ProviderTestResultProps {
  onRetry: () => void;
  result: TestProviderResult;
}

export function ProviderTestResult(props: ProviderTestResultProps) {
  const [expanded, setExpanded] = createSignal(false);

  // Virtual list for models
  const [scrollRef, setScrollRef] = createSignal<HTMLDivElement | null>(null);
  const models = () => (props.result.success ? props.result.models : []);

  const virtualizer = createMemo(() => {
    void scrollRef();
    return createVirtualizer({
      count: models().length,
      getScrollElement: () => (scrollRef()?.isConnected ? scrollRef() : null),
      getItemKey: (index) => models()[index].id,
      estimateSize: () => 42,
      overscan: 10
    });
  });

  return (
    <Show
      fallback={
        <Alert variant="destructive">
          <div class="flex items-start gap-3">
            <span class="icon-[heroicons--x-circle-solid] mt-0.5 h-5 w-5 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <AlertTitle>Connection Failed</AlertTitle>
                <Badge round variant="error">
                  Error
                </Badge>
              </div>

              <AlertDescription class="mt-2">{props.result.error}</AlertDescription>

              <Button class="mt-3" onClick={props.onRetry} size="sm" variant="outline">
                <span>Try Again</span>
                <span class="icon-[heroicons--arrow-path-solid] h-4 w-4" />
              </Button>
            </div>
          </div>
        </Alert>
      }
      when={props.result.success}
    >
      <Card class="border-success/80 bg-success/20">
        <CardHeader class="flex flex-row gap-3 items-start p-3 pb-0">
          <span class="icon-[heroicons--check-circle-solid] size-5 text-success" />
          <div class="text-sm text-muted-foreground flex flex-wrap items-baseline gap-x-2">
            <span class="font-medium text-foreground">Connection Successful</span>
          </div>
        </CardHeader>
        <CardContent class="p-3 pt-0">
          <Show when={models().length > 0}>
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
                  {models().length} model
                  {models().length > 1 ? 's' : ''} available
                </span>
              </button>

              <Show when={expanded()}>
                <div
                  class="mt-3 rounded border border-border overflow-auto"
                  ref={setScrollRef}
                  style={{ 'max-height': '300px' }}
                >
                  <div
                    style={{ height: `${virtualizer().getTotalSize()}px`, position: 'relative' }}
                  >
                    <For each={virtualizer().getVirtualItems()}>
                      {(virtualRow) => {
                        const model = models()[virtualRow.index];
                        return (
                          <div
                            class="absolute left-0 top-0 w-full truncate border-b border-border"
                            style={{
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                              padding: '0.5rem 1rem'
                            }}
                          >
                            <code class="text-sm">{model.id}</code>
                            <Show when={model.name}>
                              <div class="text-xs text-muted-foreground">{model.name}</div>
                            </Show>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </CardContent>
      </Card>
    </Show>
  );
}

export default ProviderTestResult;
