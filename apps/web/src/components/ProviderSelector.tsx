import { createWritableMemo } from '@solid-primitives/memo';
import Fuse from 'fuse.js';
import { createMemo } from 'solid-js';

import type { TProvider } from '~/db/schema';

import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxItemLabel,
	ComboboxTrigger
} from './ui/combobox';

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
	const sorterFuse = createMemo(
		() =>
			new Fuse(providers(), {
				threshold: 1,
				keys: ['name'],
				isCaseSensitive: false,
				shouldSort: true
			})
	);
	const sortedProviders = createMemo(() =>
		input().length > 0 ?
			sorterFuse()
				.search(input())
				.map((match) => match.item)
		:	providers()
	);

	const filterFuse = createMemo(
		() =>
			new Fuse(providers(), {
				threshold: 0.5,
				keys: ['name'],
				isCaseSensitive: false,
				shouldSort: true
			})
	);
	const filteredProviders = createMemo(() =>
		input().length > 0 ?
			filterFuse()
				.search(input())
				.map((match) => match.item)
		:	providers()
	);

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
