import { createWritableMemo } from '@solid-primitives/memo';
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemLabel,
  ComboboxTrigger
} from 'ui/combobox';

import type { TProvider } from '~/db/schema';
import { useFuse } from '~/primitives/use-fuse';

export function ProviderSelector(props: {
  class?: string;
  onChange: (provider: TProvider) => void;
  providers: TProvider[];
  selectedProvider: null | TProvider;
}) {
  const [input, setInput] = createWritableMemo<string>(() =>
    props.selectedProvider !== null ? props.selectedProvider.name : ''
  );

  const providers = () => props.providers;

  const sortedProviders = useFuse({
    items: providers,
    query: input,
    returnAllOnEmptyQuery: true,
    isCaseSensitive: false,
    keys: ['name'],
    shouldSort: true,
    threshold: 1
  });

  const filteredProviders = useFuse({
    items: providers,
    query: input,
    returnAllOnEmptyQuery: true,
    isCaseSensitive: false,
    keys: ['name'],
    shouldSort: true,
    threshold: 0.5
  });

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
        if (!value) return;
        props.onChange(value);
      }}
      optionLabel="name"
      options={sortedProviders()}
      optionTextValue="name"
      optionValue="id"
      placeholder="Choose provider"
      value={props.selectedProvider}
    >
      <ComboboxControl aria-label="Provider">
        <ComboboxInput onInput={(e) => setInput(e.currentTarget.value)} value={input()} />
        <ComboboxTrigger />
      </ComboboxControl>
      <ComboboxContent />
    </Combobox>
  );
}

export default ProviderSelector;
