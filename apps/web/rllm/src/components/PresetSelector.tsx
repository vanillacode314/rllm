import { createWritableMemo } from '@solid-primitives/memo';
import { createVirtualizer } from '@tanstack/solid-virtual';
import Fuse from 'fuse.js';
import { createMemo, createSignal, For } from 'solid-js';

import type { TChatPreset } from '~/db/app-schema';

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
} from './ui/combobox';

export function PresetSelector(props: {
  class?: string;
  onChange: (preset: TChatPreset) => void;
  presets: TChatPreset[];
}) {
  const [input, setInput] = createWritableMemo<string>(() => '');

  const sorterFuse = createMemo(
    () =>
      new Fuse(props.presets, {
        isCaseSensitive: false,
        keys: ['name'],
        shouldSort: true,
        threshold: 1
      })
  );
  const sortedPresets = createMemo(() =>
    input().length > 0
      ? sorterFuse()
          .search(input())
          .map((match) => match.item)
      : props.presets
  );

  const filterFuse = createMemo(
    () =>
      new Fuse(props.presets, {
        isCaseSensitive: false,
        keys: ['name'],
        shouldSort: true,
        threshold: 0.5
      })
  );
  const filteredPresets = createMemo(() =>
    input().length > 0
      ? filterFuse()
          .search(input())
          .map((match) => match.item)
      : props.presets
  );

  const [listboxRef, setListboxRef] = createSignal<HTMLUListElement | null>(null);

  const virtualizer = createMemo(() =>
    createVirtualizer({
      count: filteredPresets().length,
      estimateSize: () => 32,
      getItemKey: (index: number) => filteredPresets()[index].id,
      getScrollElement: listboxRef,
      overscan: 10
    })
  );

  return (
    <Combobox<TChatPreset>
      class={props.class}
      defaultFilter={(option) => filteredPresets().includes(option)}
      onChange={async (value) => {
        if (!value) return;
        props.onChange(value);
        setInput('');
      }}
      optionLabel="name"
      options={sortedPresets()}
      optionTextValue="name"
      optionValue="id"
      placeholder="Select a preset..."
      virtualized
    >
      <ComboboxControl aria-label="Presets">
        <ComboboxInput
          onInput={(e) => {
            setInput(e.currentTarget.value);
          }}
          value={input()}
        />
        <ComboboxTrigger />
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxListbox
          ref={setListboxRef}
          scrollToItem={(key) =>
            virtualizer().scrollToIndex(filteredPresets().findIndex((preset) => preset.id === key))
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
                        <ComboboxItemLabel class="truncate">{item.rawValue.name}</ComboboxItemLabel>
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

export default PresetSelector;
