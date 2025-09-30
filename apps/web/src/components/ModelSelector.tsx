import { createWritableMemo } from '@solid-primitives/memo'
import { useQuery } from '@tanstack/solid-query'
import { createVirtualizer } from '@tanstack/solid-virtual'
import Fuse from 'fuse.js'
import { createMemo, createSignal, For } from 'solid-js'
import { Option } from 'ts-result-option'

import type { TModel } from '~/types'

import { queries } from '~/queries'
import { openAiAdapter } from '~/utils/adapters/openai'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'

import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemLabel,
  ComboboxListbox,
  ComboboxTrigger,
} from './ui/combobox'
import type { $Fetch } from 'ofetch'

export function ModelSelector(props: { class?: string; fetcher: $Fetch }) {
  const selectedModelId = useQuery(() => queries.models.selected())
  const selectedProviderId = useQuery(() => queries.providers.selected())
  const selectedProvider = useQuery(() => ({
    ...queries.providers.byId(selectedProviderId.data!),
    enabled: !!selectedProviderId.data,
  }))

  const defaultModels = () =>
    selectedProvider.isPending
      ? []
      : selectedProvider.data!.defaultModelIds.map((id) => ({ id }))

  const fetcher = () => props.fetcher

  const models = useQuery(() => ({
    enabled: !!selectedProvider.data,
    queryKey: ['providers', selectedProviderId.data, 'models', 'all'],
    queryFn: ({ signal }) =>
      openAiAdapter
        .fetchAllModels(fetcher(), { signal })
        .unwrapOrElse(defaultModels),
    placeholderData: defaultModels(),
  }))

  const [input, setInput] = createWritableMemo<string>(() =>
    selectedModelId.isPending ? '' : selectedModelId.data!,
  )

  const fuse = createMemo(
    () =>
      new Fuse(models.data, {
        threshold: 0.5,
        keys: ['id'],
        isCaseSensitive: false,
        shouldSort: true,
        sortFn: (a, b) => a.score - b.score,
      }),
  )
  const filteredModels = createMemo(() =>
    input().length > 0
      ? fuse()
          .search(input())
          .map((match) => match.item)
      : models.data,
  )
  const [listboxRef, setListboxRef] = createSignal<HTMLUListElement | null>(
    null,
  )

  const virtualizer = createMemo(() =>
    createVirtualizer({
      count: filteredModels().length,
      getScrollElement: listboxRef,
      getItemKey: (index: number) => filteredModels()[index].id,
      estimateSize: () => 32,
      overscan: 10,
    }),
  )

  return (
    <Combobox<TModel>
      class={props.class}
      defaultFilter={(option) => filteredModels().includes(option)}
      onChange={async (value) => {
        if (!value) return
        await createMessages({
          user_intent: 'set_user_metadata',
          meta: { id: 'selected-model-id', value: value.id },
        })
        await Promise.all([
          queryClient.invalidateQueries(
            queries.userMetadata.byId('selected-model-id'),
          ),
          queryClient.invalidateQueries(queries.models.selected()),
        ])
      }}
      optionLabel="id"
      options={models.data}
      optionTextValue="id"
      optionValue="id"
      placeholder="Select a model..."
      value={{ id: selectedModelId.data ?? '' }}
      virtualized
    >
      <ComboboxControl aria-label="Models">
        <ComboboxInput
          onInput={(e) => {
            setInput(e.currentTarget.value)
            listboxRef()?.scrollTo({
              top: listboxRef()?.scrollHeight,
            })
          }}
          value={input()}
        />
        <ComboboxTrigger />
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxListbox
          ref={setListboxRef}
          scrollToItem={(key) =>
            virtualizer().scrollToIndex(
              filteredModels().findIndex((model) => model.id === key),
            )
          }
          style={{ 'max-height': '300px', width: '100%', overflow: 'auto' }}
        >
          {(items) => (
            <div
              style={{
                height: `${virtualizer().getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              <For each={virtualizer().getVirtualItems()}>
                {(virtualRow) => {
                  const item = items().getItem(virtualRow.key as string)
                  if (item) {
                    return (
                      <ComboboxItem
                        item={item}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <ComboboxItemLabel class="truncate">
                          {item.rawValue.id}
                        </ComboboxItemLabel>
                        <ComboboxItemIndicator />
                      </ComboboxItem>
                    )
                  }
                }}
              </For>
            </div>
          )}
        </ComboboxListbox>
      </ComboboxContent>
    </Combobox>
  )
}

export default ModelSelector
