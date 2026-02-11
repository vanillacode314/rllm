import type { ParsedLocation } from '@tanstack/solid-router';

import { type } from 'arktype';
import { Option } from 'ts-result-option';

import { logger } from '~/db/client';
import { fetchers } from '~/queries';
import { chatSettings, setChatSettings } from '~/routes/chat/-state';

export const chatSettingsSchema = type({
	modelId: 'string',
	providerId: 'string',
	systemPrompt: 'string = ""'
	// 'temperature?': 'number'
	// "topP?": "number",
	// "frequencyPenalty?": "number",
	// "presencePenalty?": "number",
	// "maxTokens?": "number",
	// "stop?": "string[]",
});
export type TChatSettings = typeof chatSettingsSchema.infer;

export async function initChatSettings() {
	const [
		defaultProviderId,
		defaultModelId,
		titleGenerationProviderId,
		titleGenerationModelId,
		providers
	] = await Promise.all([
		fetchers.userMetadata.byId('default-provider-id'),
		fetchers.userMetadata.byId('default-model-id'),
		fetchers.userMetadata.byId('title-generation-provider-id'),
		fetchers.userMetadata.byId('title-generation-model-id'),
		fetchers.providers.getAllProviders()
	]);
	if (providers.length === 0) {
		console.debug(`[Initializing Chat Settings] No providers found, skipping initialization`);
		return;
	}
	const tasks = [] as (() => Promise<unknown>)[];
	if (defaultProviderId === null) {
		console.debug(
			`[Initializing Chat Settings] defaultProviderId is null, setting to ${providers[0].id}`
		);
		tasks.push(() =>
			logger.dispatch(
				{
					type: 'setUserMetadata',
					data: {
						id: 'default-provider-id',
						value: providers[0].id
					}
				},
				{
					type: 'setUserMetadata',
					data: {
						id: 'default-model-id',
						value: providers[0].defaultModelIds[0]
					}
				}
			)
		);
	} else if (!providers.some((provider) => provider.id !== defaultProviderId)) {
		console.debug(
			`[Initializing Chat Settings] defaultProviderId ${defaultProviderId} not found, setting to ${providers[0].id}`
		);
		tasks.push(() =>
			logger.dispatch(
				{
					type: 'setUserMetadata',
					data: {
						id: 'default-provider-id',
						value: providers[0].id
					}
				},
				{
					type: 'setUserMetadata',
					data: {
						id: 'default-model-id',
						value: providers[0].defaultModelIds[0]
					}
				}
			)
		);
	} else if (defaultModelId === null) {
		console.debug(
			`[Initializing Chat Settings] defaultModelId is null, setting to ${providers[0].defaultModelIds[0]}`
		);
		const provider = await fetchers.providers.byId(defaultProviderId);
		if (!provider) throw new Error('Provider not found');
		tasks.push(() =>
			logger.dispatch({
				type: 'setUserMetadata',
				data: {
					id: 'default-model-id',
					value: provider.defaultModelIds[0]
				}
			})
		);
	}

	if (titleGenerationProviderId === null) {
		console.debug(
			`[Initializing Chat Settings] titleGenerationProviderId is null, setting to ${providers[0].id}`
		);
		tasks.push(() =>
			logger.dispatch({
				type: 'setUserMetadata',
				data: {
					id: 'title-generation-provider-id',
					value: providers[0].id
				}
			})
		);
	} else if (!providers.some((provider) => provider.id !== titleGenerationProviderId)) {
		console.debug(
			`[Initializing Chat Settings] titleGenerationProviderId ${titleGenerationProviderId} not found, setting to ${providers[0].id}`
		);
		tasks.push(() =>
			logger.dispatch(
				{
					type: 'setUserMetadata',
					data: {
						id: 'title-generation-provider-id',
						value: providers[0].id
					}
				},
				{
					type: 'setUserMetadata',
					data: {
						id: 'title-generation-model-id',
						value: providers[0].defaultModelIds[0]
					}
				}
			)
		);
	} else if (titleGenerationModelId === null) {
		console.debug(
			`[Initializing Chat Settings] titleGenerationModelId is null, setting to ${providers[0].defaultModelIds[0]}`
		);
		const provider = await fetchers.providers.byId(titleGenerationProviderId);
		if (!provider) throw new Error('Provider not found');
		tasks.push(() =>
			logger.dispatch({
				type: 'setUserMetadata',
				data: {
					id: 'title-generation-model-id',
					value: provider.defaultModelIds[0]
				}
			})
		);
	}
	await Promise.all(tasks.map((task) => task()));
	setChatSettings(
		Option.Some({
			modelId: defaultModelId ?? providers[0].defaultModelIds[0],
			providerId: defaultProviderId ?? providers[0].id,
			systemPrompt: ''
		})
	);
}

export async function updateChatSettings(
	settings: Partial<TChatSettings>,
	location: ParsedLocation<{ id?: string }>
) {
	const chatId = location.pathname.startsWith('/chat/') ? location.search.id : undefined;
	if (chatSettings().isNone()) return;
	const newValue = { ...chatSettings().unwrap(), ...settings };
	setChatSettings(Option.Some(newValue));
	if (chatId) {
		await logger.dispatch({
			type: 'updateChat',
			data: { id: chatId, settings: newValue }
		});
	}
}
