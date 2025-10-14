import { AsyncResult, Option } from 'ts-result-option';
import { safeFetch, safeParseJson, tryBlock } from 'ts-result-option/utils';

import { parseSSEEventChunk } from '~/utils/response';

import { jsonRpcResponseSchema, type TJSONRPCResponse } from './types';

class JSONRPCError extends Error {
	constructor(
		public message: string,
		public code: number
	) {
		super(`${message} (code: ${code})`);
		this.name = 'JSONRPCError';
		Object.setPrototypeOf(this, JSONRPCError.prototype);
	}
}

function makeJSONRPCCall(
	url: string,
	method: string,
	opts: {
		extraBody?: Record<string, unknown>;
		extraHeaders?: Record<string, unknown>;
		params?: Record<string, unknown>;
	} = {}
): AsyncResult<{ response: Response; result: unknown }, Error | JSONRPCError> {
	const { extraBody = {}, extraHeaders = {}, params } = opts;
	return tryBlock(
		async function* () {
			const response = yield* safeFetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json, text/event-stream',
					...extraHeaders
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					method,
					params,
					...extraBody
				})
			}).context('Error while making json rpc call');

			if (!response.ok) {
				return AsyncResult.Err(new Error('Response is not ok'));
			}
			if (response.status === 202) {
				return AsyncResult.Ok({ response, result: undefined });
			}

			const text = yield* AsyncResult.fromPromise(
				() => response.text(),
				(e) => new Error(`Error while making json rpc call`, { cause: e })
			);
			const contentType = yield* Option.fromNull(response.headers.get('Content-Type')).okOrElse(
				() => new Error('Content-Type header is missing')
			);

			let json: TJSONRPCResponse;
			if (contentType === 'application/json') {
				json = yield* safeParseJson(text, {
					validate: jsonRpcResponseSchema.assert
				}).context('Error while parsing json rpc response');
			} else if (contentType === 'text/event-stream')
				json = yield* parseSSEEventChunk(text)
					.okOrElse(() => new Error('Error while parsing SSE event chunk'))
					.andThen((events) =>
						safeParseJson(events[0].data, {
							validate: jsonRpcResponseSchema.assert
						})
					)
					.context('Error while parsing json rpc response');
			else return AsyncResult.Err(new Error('Unsupported content type'));

			if ('error' in json) {
				return AsyncResult.Err(new JSONRPCError(json.error.message, json.error.code));
			}
			return AsyncResult.Ok({ response, result: json.result });
		},
		(e) => new Error(`Error while making json rpc call`, { cause: e })
	);
}

export { JSONRPCError, makeJSONRPCCall };
