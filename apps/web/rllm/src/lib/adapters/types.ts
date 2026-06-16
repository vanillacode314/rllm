import { AsyncResult, Option } from 'ts-result-option';

import type { TMessage } from '~/types/chat';

import { type TModel, type TTool } from '~/types';

export type TAdapter = {
  fetchAllModels: (signal?: AbortSignal) => AsyncResult<TModel[], Error>;
  generateCompletion: (opts: {
    messages: TMessage[];
    model: string;
    reasoningEffort: 'high' | 'low' | 'medium' | 'minimal' | 'none' | 'xhigh';
    signal?: AbortSignal;
    system?: string;
    tools?: TTool[];
  }) => AsyncGenerator<TChatCompletionChunk, TChatCompletionLastChunk, void>;
  id: string;
};

export type TChatCompletionChunk = {
  content: Option<string>;
  reasoning: Option<string>;
  tools: Option<Array<{ arguments: Option<string>; id: string; name: Option<string> }>>;
};

export type TChatCompletionLastChunk =
  | {
      error: unknown;
      finish_reason: 'error';
    }
  | {
      finish_reason: 'stop' | 'tool_calls';
    };
