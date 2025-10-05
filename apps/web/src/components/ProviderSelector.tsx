import { createWritableMemo } from '@solid-primitives/memo'
import { useQuery } from '@tanstack/solid-query'
import Fuse from 'fuse.js'
import { createMemo } from 'solid-js'

import type { TProvider } from '~/db/schema'

import { queries } from '~/queries'
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
  ComboboxTrigger,
} from './ui/combobox'

export function ProviderSelector(props: { class?: string }) {
  const providers = useQuery(() => ({
    ...queries.providers.all(),
    placeholderData: [],
  }))
  const selectedProviderId = useQuery(() => queries.providers.selected())
  const selectedProvider = useQuery(() => ({
    ...queries.providers.byId(selectedProviderId.data!),
    enabled: !!selectedProviderId.data,
  }))

  const fuse = createMemo(
    () =>
      new Fuse(providers.isSuccess ? providers.data : [], {
        threshold: 0.5,
        keys: ['name'],
        isCaseSensitive: false,
        shouldSort: true,
        sortFn: (a, b) => a.score - b.score,
      }),
  )

  const [input, setInput] = createWritableMemo<string>(() =>
    selectedProvider.isSuccess ? selectedProvider.data!.name : '',
  )

  const filteredProviders = createMemo(() =>
    input().length > 0
      ? fuse()
          .search(input())
          .map((match) => match.item)
      : providers.data!,
  )
  return (
    <Combobox<TProvider>
      class={props.class}
      defaultFilter={(option) => filteredProviders().includes(option)}
      itemComponent={(props) => (
        <ComboboxItem item={props.item}>
          <ComboboxItemLabel>{props.item.rawValue.name}</ComboboxItemLabel>
          <ComboboxItemIndicator />
        </ComboboxItem>
      )}
      onChange={async (value) => {
        if (!value) return
        await createMessages(
          {
            user_intent: 'set_user_metadata',
            meta: { id: 'selected-provider-id', value: value.id },
          },
          {
            user_intent: 'set_user_metadata',
            meta: { id: 'selected-model-id', value: value.defaultModelIds[0] },
          },
        )
        await Promise.all([
          queryClient.invalidateQueries(
            queries.userMetadata.byId('selected-provider-id'),
          ),
          queryClient.invalidateQueries(
            queries.userMetadata.byId('selected-model-id'),
          ),
          queryClient.invalidateQueries(queries.providers.selected()),
          queryClient.invalidateQueries(queries.models.selected()),
        ])
      }}
      optionLabel="name"
      options={providers.data ?? []}
      optionTextValue="name"
      optionValue="id"
      placeholder="Choose provider"
      value={selectedProvider.data}
    >
      <ComboboxControl aria-label="Provider">
        <ComboboxInput
          onInput={(e) => setInput(e.currentTarget.value)}
          value={input()}
        />
        <ComboboxTrigger />
      </ComboboxControl>
      <ComboboxContent />
    </Combobox>
  )
}

export default ProviderSelector
