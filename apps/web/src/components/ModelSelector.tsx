import { createWritableMemo } from '@solid-primitives/memo';
import { useQuery } from '@tanstack/solid-query';
import { createVirtualizer } from '@tanstack/solid-virtual';
import Fuse from 'fuse.js';
import { createMemo, createSignal, For } from 'solid-js';

import type { $ResultFetcher } from '~/lib/adapters/types';
import type { TModel, TProvider } from '~/types';

import { openAiAdapter } from '~/lib/adapters/openai';

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

export function ModelSelector(props: {
	class?: string;
	fetcher: $ResultFetcher;
	onChange: (model: TModel) => void;
	selectedModelId: null | string;
	selectedProvider: null | TProvider;
}) {
	const defaultModels = () =>
		props.selectedProvider !== null ?
			props.selectedProvider.defaultModelIds.map((id) => ({ id }))
		:	[];

	const fetcher = () => props.fetcher;

	const modelsQuery = useQuery(() => ({
		enabled: props.selectedProvider !== null,
		queryKey: ['providers', props.selectedProvider?.id, 'models', 'all'],
		queryFn: ({ signal }) =>
			openAiAdapter.fetchAllModels(fetcher(), { signal }).unwrapOrElse(defaultModels),
		staleTime: 5000
	}));

	const [input, setInput] = createWritableMemo<string>(() =>
		props.selectedModelId !== null ? props.selectedModelId : ''
	);

	const models = () => (modelsQuery.isSuccess ? modelsQuery.data : defaultModels());

	const sorterFuse = createMemo(
		() =>
			new Fuse(models(), {
				threshold: 1,
				keys: ['id'],
				isCaseSensitive: false,
				shouldSort: true
			})
	);
	const sortedModels = createMemo(() =>
		input().length > 0 ?
			sorterFuse()
				.search(input())
				.map((match) => match.item)
		:	models()
	);

	const filterFuse = createMemo(
		() =>
			new Fuse(models(), {
				threshold: 0.5,
				keys: ['id'],
				isCaseSensitive: false,
				shouldSort: true
			})
	);
	const filteredModels = createMemo(() =>
		input().length > 0 ?
			filterFuse()
				.search(input())
				.map((match) => match.item)
		:	models()
	);

	const [listboxRef, setListboxRef] = createSignal<HTMLUListElement | null>(null);

	const virtualizer = createMemo(() =>
		createVirtualizer({
			count: filteredModels().length,
			getScrollElement: listboxRef,
			getItemKey: (index: number) => filteredModels()[index].id,
			estimateSize: () => 32,
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
					style={{ 'max-height': '300px', width: '100%', overflow: 'auto' }}
				>
					{(items) => (
						<div
							style={{
								height: `${virtualizer().getTotalSize()}px`,
								width: '100%',
								position: 'relative'
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
													position: 'absolute',
													top: 0,
													left: 0,
													width: '100%',
													height: `${virtualRow.size}px`,
													transform: `translateY(${virtualRow.start}px)`
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
