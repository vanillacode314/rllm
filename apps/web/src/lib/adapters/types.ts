import {
	type FetchOptions,
	type FetchRequest,
	type MappedResponseType,
	type ResponseType
} from 'ofetch';
import { AsyncResult, type Option } from 'ts-result-option';

import type { TLLMMessageChunk, TMessage } from '~/types/chat';

import { type TModel, type TTool } from '~/types';

interface $ResultFetcher {
	<T = any, R extends ResponseType = 'json'>(
		request: FetchRequest,
		options?: FetchOptions<R>
	): AsyncResult<MappedResponseType<R, T>, unknown>;
}

interface TAdapter {
	fetchAllModels: (
		fetcher: $ResultFetcher,
		opts: FetchOptions<'json'>
	) => AsyncResult<TModel[], Error>;
	handleChatCompletion: (opts: {
		fetcher: $ResultFetcher;
		messages: TMessage[];
		model: string;
		onAbort: Option<() => void>;
		onChunk: Option<(chunks: TLLMMessageChunk[]) => void>;
		signal: Option<AbortSignal>;
		system?: string;
		tools: Option<TTool[]>;
	}) => AsyncResult<void, Error>;
	id: string;
	makeFetcher: (baseUrl?: string, token?: string) => $ResultFetcher;
	processContentDelta: <T extends [any]>(...args: T) => Option<string>;
	processReasoningDelta: <T extends [any]>(...args: T) => Option<string>;
	processToolCallDelta: <T extends [any]>(
		...args: T
	) => Array<{
		function: {
			arguments: Option<string>;
			name: Option<string>;
		};
		id: Option<string>;
	}>;
}

export type { $ResultFetcher, TAdapter };
