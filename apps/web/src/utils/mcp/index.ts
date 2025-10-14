import { type } from 'arktype';
import { AsyncResult, Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import {
	type TValidMcpServerJSONMethods,
	type TValidMcpServerJSONResponses,
	validMcpServerJSONResponses
} from './types';
import { makeJSONRPCCall } from './utils';

function initializeMCPSession(url: string, id: string): AsyncResult<Option<string>, Error> {
	return tryBlock(
		async function* () {
			const { response } = yield* makeJSONRPCCall(url, 'initialize', {
				extraBody: { id },
				params: {
					protocolVersion: '2024-11-05',
					capabilities: {
						roots: {
							listChanged: true
						},
						sampling: {},
						elicitation: {}
					},
					clientInfo: {
						name: 'R-LLM',
						title: 'R-LLM',
						version: '1.0.0'
					}
				}
			});
			const sessionId = Option.fromNull(response.headers.get('mcp-session-id'));
			if (sessionId.isNone()) {
				return AsyncResult.Err(new Error('No session ID returned', { cause: response }));
			}
			yield* makeJSONRPCCall(url, 'notifications/initialized', {
				extraHeaders: {
					'mcp-session-id': sessionId.unwrap()
				}
			});
			return AsyncResult.Ok(sessionId);
		},
		(e) => new Error(`Failed to initialize MCP session`, { cause: e })
	);
}

function makeMCPCall<
	const TMethod extends TValidMcpServerJSONMethods['method'],
	TResponse = TValidMcpServerJSONResponses[`"${TMethod}"`]
>(config: {
	id: string;
	method: TMethod;
	params?: Record<string, unknown>;
	sessionId: string;
	url: string;
}): AsyncResult<TResponse, Error> {
	const { id, method, params, sessionId, url } = config;
	return makeJSONRPCCall(url, method, {
		extraBody: { id },
		extraHeaders: {
			'mcp-session-id': sessionId
		},
		params
	})
		.map((value) => value.result)
		.andThen((value) => {
			const responseSchema = validMcpServerJSONResponses.get(`"${method}"`);
			if (!responseSchema) {
				return AsyncResult.Err(new Error(`Response not defined for method: ${method}`));
			}
			const result = responseSchema(value);
			if (result instanceof type.errors) {
				return AsyncResult.Err(new Error(result.summary, { cause: result }));
			}
			return AsyncResult.Ok(result as TResponse);
		})
		.context('Failed to make MCP call');
}

export { initializeMCPSession, makeMCPCall };
