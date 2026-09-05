import { createWritableMemo } from '@solid-primitives/memo';
import { useQuery } from '@tanstack/solid-query';
import { createVirtualizer } from '@tanstack/solid-virtual';
import Fuse from 'fuse.js';
import { createMemo, createSignal, For } from 'solid-js';
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemLabel,
  ComboboxListbox,
  ComboboxTrigger
} from 'ui/combobox';

import type { TAdapter } from '~/lib/adapters/types';
import type { TModel, TProvider } from '~/types';

export function ModelSelector(props: {
  adapter: null | TAdapter;
  class?: string;
  onChange: (model: TModel) => void;
  selectedModelId: null | string;
  selectedProvider: null | TProvider;
}) {
  const defaultModels = () =>
    props.selectedProvider !== null
      ? props.selectedProvider.defaultModelIds.map((id) => ({ id }))
      : [];

  const adapter = () => props.adapter;

  const modelsQuery = useQuery(() => ({
    enabled: adapter() !== null && props.selectedProvider !== null,
    queryFn: () => adapter()!.fetchAllModels().unwrapOrElse(defaultModels),
    queryKey: ['providers', props.selectedProvider?.id, 'models', 'all'],
    staleTime: 5000
  }));

  const [input, setInput] = createWritableMemo<string>(() =>
    props.selectedModelId !== null ? props.selectedModelId : ''
  );

  const models = () => (modelsQuery.isSuccess ? modelsQuery.data : defaultModels());

  const sorterFuse = createMemo(
    () =>
      new Fuse(models(), {
        isCaseSensitive: false,
        keys: ['id'],
        shouldSort: true,
        threshold: 1
      })
  );
  const sortedModels = createMemo(() =>
    input().length > 0
      ? sorterFuse()
          .search(input())
          .map((match) => match.item)
      : models()
  );

  const filterFuse = createMemo(
    () =>
      new Fuse(models(), {
        isCaseSensitive: false,
        keys: ['id'],
        shouldSort: true,
        threshold: 0.5
      })
  );
  const filteredModels = createMemo(() =>
    input().length > 0
      ? filterFuse()
          .search(input())
          .map((match) => match.item)
      : models()
  );

  const [listboxRef, setListboxRef] = createSignal<HTMLUListElement | null>(null);

  const virtualizer = createMemo(() =>
    createVirtualizer({
      count: filteredModels().length,
      estimateSize: () => 32,
      getItemKey: (index: number) => filteredModels()[index].id,
      getScrollElement: listboxRef,
      overscan: 10
    })
  );

  return (
    <Combobox<TModel>
      class={props.class}
      defaultFilter={(option) => filteredModels().includes(option)}
      onChange={async (value) => {
        if (!value) return;
        props.onChange(value);
      }}
      optionLabel="id"
      options={sortedModels()}
      optionTextValue="id"
      optionValue="id"
      placeholder="Select a model..."
      value={{ id: props.selectedModelId ?? '' }}
      virtualized
    >
      <ComboboxControl aria-label="Models">
        <ComboboxInput
          onInput={(e) => {
            setInput(e.currentTarget.value);
            // listboxRef()?.scrollTo({
            // 	top: listboxRef()?.scrollHeight
            // });
          }}
          value={input()}
        />
        <ComboboxTrigger />
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxListbox
          ref={setListboxRef}
          scrollToItem={(key) =>
            virtualizer().scrollToIndex(filteredModels().findIndex((model) => model.id === key))
          }
          style={{ 'max-height': '300px', overflow: 'auto', width: '100%' }}
        >
          {(items) => (
            <div
              style={{
                height: `${virtualizer().getTotalSize()}px`,
                position: 'relative',
                width: '100%'
              }}
            >
              <For each={virtualizer().getVirtualItems()}>
                {(virtualRow) => {
                  const item = items().getItem(virtualRow.key as string);
                  if (item) {
                    return (
                      <ComboboxItem
                        item={item}
                        style={{
                          height: `${virtualRow.size}px`,
                          left: 0,
                          position: 'absolute',
                          top: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                          width: '100%'
                        }}
                      >
                        <ComboboxItemLabel class="truncate">{item.rawValue.id}</ComboboxItemLabel>
                        <ComboboxItemIndicator />
                      </ComboboxItem>
                    );
                  }
                }}
              </For>
            </div>
          )}
        </ComboboxListbox>
      </ComboboxContent>
    </Combobox>
  );
}

export default ModelSelector;
