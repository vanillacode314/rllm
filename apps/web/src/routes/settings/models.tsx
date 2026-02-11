import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, redirect } from '@tanstack/solid-router';
import { createMemo, Show } from 'solid-js';

import ModelSelector from '~/components/ModelSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '~/components/ui/select';
import { logger } from '~/db/client';
import { openAiAdapter } from '~/lib/adapters/openai';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/models')({
	component: SettingsModelComponent,
	beforeLoad: async () => {
		const providers = await queryClient.ensureQueryData(queries.providers.all());
		if (providers.length === 0) return redirect({ to: '/settings/providers' });
	},
	loader: async () => {
		await Promise.all([
			queryClient.ensureQueryData(queries.userMetadata.byId('title-generation-provider-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('default-provider-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('title-generation-model-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('default-model-id'))
		]);
	}
});

function SettingsModelComponent() {
	const providers = useQuery(queries.providers.all);
	const titleGenerationProviderId = useQuery(() =>
		queries.userMetadata.byId('title-generation-provider-id')
	);
	const provider = useQuery(() => ({
		enabled:
			titleGenerationProviderId.isSuccess && titleGenerationProviderId.data !== 'current-model',
		...queries.providers.byId(titleGenerationProviderId.data ?? '')
	}));

	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const proxifyUrl = (url: string) =>
		proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url;
	const fetcher = createMemo(() => {
		const token = provider.isSuccess ? provider.data.token : undefined;
		const url = provider.isSuccess ? proxifyUrl(provider.data!.baseUrl) : undefined;
		return openAiAdapter.makeFetcher(url, token);
	});

	const titleGenerationModelId = useQuery(() =>
		queries.userMetadata.byId('title-generation-model-id')
	);

	const defaultProviderId = useQuery(() => queries.userMetadata.byId('default-provider-id'));
	const defaultProvider = useQuery(() => ({
		enabled: defaultProviderId.isSuccess && defaultProviderId.data !== 'current-model',
		...queries.providers.byId(defaultProviderId.data ?? '')
	}));

	const defaultFetcher = createMemo(() => {
		const token = defaultProvider.isSuccess ? defaultProvider.data.token : undefined;
		const url = defaultProvider.isSuccess ? proxifyUrl(defaultProvider.data!.baseUrl) : undefined;
		return openAiAdapter.makeFetcher(url, token);
	});

	const defaultModelId = useQuery(() => queries.userMetadata.byId('default-model-id'));

	const options = createMemo(() => {
		const opts = [{ value: 'current-model', label: 'Current Model' }];
		for (const provider of providers.data ?? [])
			opts.push({ value: provider.id, label: provider.name });
		return opts;
	});

	async function updateTitleGenerationProvider(providerId: string) {
		const provider = providers.data?.find((p) => p.id === providerId);
		await logger.dispatch(
			{
				type: 'setUserMetadata',
				data: {
					id: 'title-generation-provider-id',
					value: providerId
				}
			},
			{
				type: 'setUserMetadata',
				data: {
					id: 'title-generation-model-id',
					value: provider?.defaultModelIds[0] ?? 'current-model'
				}
			}
		);
	}

	async function updateTitleGenerationModel(modelId: string) {
		await logger.dispatch({
			type: 'setUserMetadata',
			data: {
				id: 'title-generation-model-id',
				value: modelId
			}
		});
	}

	async function updateDefaultProvider(providerId: string) {
		const provider = providers.data?.find((p) => p.id === providerId);
		await logger.dispatch(
			{
				type: 'setUserMetadata',
				data: {
					id: 'default-provider-id',
					value: providerId
				}
			},
			{
				type: 'setUserMetadata',
				data: {
					id: 'default-model-id',
					value: provider?.defaultModelIds[0] ?? 'current-model'
				}
			}
		);
	}

	async function updateDefaultModel(modelId: string) {
		await logger.dispatch({
			type: 'setUserMetadata',
			data: {
				id: 'default-model-id',
				value: modelId
			}
		});
	}

	return (
		<div class="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Title &amp; Tags Generation</CardTitle>
					<CardDescription>
						Customize what model is used for title and tags generation.
					</CardDescription>
				</CardHeader>
				<CardContent class="flex flex-col gap-2">
					<div class="flex gap-2 items-center">
						<Label>Provider: </Label>
						<Select
							defaultValue={options().find((opt) => opt.value === titleGenerationProviderId.data)}
							itemComponent={(props) => (
								<SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
							)}
							onChange={(value) => {
								if (!value) return;
								updateTitleGenerationProvider(value.value);
							}}
							options={options()}
							optionTextValue="label"
							optionValue="value"
						>
							<SelectTrigger aria-label="Title Generation Model">
								<SelectValue<ReturnType<typeof options>[number]>>
									{(state) => state.selectedOption().label}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
					<Show when={provider.isSuccess && provider.data}>
						<div class="flex gap-2 items-center">
							<Label>Model: </Label>
							<ModelSelector
								fetcher={fetcher()}
								onChange={(model) => updateTitleGenerationModel(model.id)}
								selectedModelId={titleGenerationModelId.data ?? null}
								selectedProvider={provider.data ?? null}
							></ModelSelector>
						</div>
					</Show>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Default Model &amp; Provider</CardTitle>
					<CardDescription>Set the default model and provider for new chats.</CardDescription>
				</CardHeader>
				<CardContent class="flex flex-col gap-2">
					<div class="flex gap-2 items-center">
						<Label>Provider: </Label>
						<Select
							defaultValue={options().find((opt) => opt.value === defaultProviderId.data)}
							itemComponent={(props) => (
								<SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
							)}
							onChange={(value) => {
								if (!value) return;
								updateDefaultProvider(value.value);
							}}
							options={options()}
							optionTextValue="label"
							optionValue="value"
						>
							<SelectTrigger aria-label="Default Provider">
								<SelectValue<ReturnType<typeof options>[number]>>
									{(state) => state.selectedOption().label}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
					<Show when={defaultProvider.isSuccess && defaultProvider.data}>
						<div class="flex gap-2 items-center">
							<Label>Model: </Label>
							<ModelSelector
								fetcher={defaultFetcher()}
								onChange={(model) => updateDefaultModel(model.id)}
								selectedModelId={defaultModelId.data ?? null}
								selectedProvider={defaultProvider.data ?? null}
							></ModelSelector>
						</div>
					</Show>
				</CardContent>
			</Card>
		</div>
	);
}
