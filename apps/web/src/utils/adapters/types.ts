import type { $Fetch, FetchOptions } from 'ofetch'
import type { AsyncResult, Option } from 'ts-result-option'

import { type } from 'arktype'

import type { TModel, TTool } from '~/types'
import type { TLLMMessageChunk, TMessage } from '~/types/chat'

const adapterSchema = type({
  id: 'string',
  makeFetcher:
    type('Function').as<
      (baseUrl: Option<string>, token: Option<string>) => $Fetch
    >(),
  fetchAllModels:
    type('Function').as<
      (fetcher: $Fetch, opts: FetchOptions) => AsyncResult<TModel[], Error>
    >(),
  handleChatCompletion:
    type('Function').as<
      (opts: {
        chunks: TMessage[]
        fetcher: $Fetch
        model: string
        system?: string
        onAbort: Option<() => void>
        onChunk: Option<(chunks: TLLMMessageChunk[]) => void>
        signal: Option<AbortSignal>
        tools: Option<TTool[]>
      }) => AsyncResult<unknown, Error>
    >(),
  processContentDelta:
    type('Function').as<<T extends [any]>(...args: T) => Option<string>>(),
  processReasoningDelta:
    type('Function').as<<T extends [any]>(...args: T) => Option<string>>(),
  processToolCallDelta: type('Function').as<
    <T extends [any]>(
      ...args: T
    ) => Array<{
      function: {
        arguments: Option<string>
        name: Option<string>
      }
      id: Option<string>
    }>
  >(),
})
type TAdapter = typeof adapterSchema.infer

export { adapterSchema }
export type { TAdapter }
