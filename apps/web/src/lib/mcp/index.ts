import { AsyncResult, Option, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import {
  type TValidMcpServerJSONMethods,
  type TValidMcpServerJSONResponses,
  validMcpServerJSONResponses
} from './types';
import { MCP_PROTOCOL_VERSION } from './types';
import { extractSessionId, makeJSONRPCCall } from './utils';

/**
 * Initialize MCP session with server
 *
 * Performs the MCP handshake: sends initialize request, receives capabilities,
 * then sends notifications/initialized.
 *
 * @param url - MCP server endpoint URL
 * @param id - Unique request ID
 * @returns AsyncResult with session ID and server capabilities
 */
function initializeMCPSession(
  url: string,
  id: string
): AsyncResult<
  {
    capabilities: unknown;
    serverInfo: { name: string; version: string };
    sessionId: Option<string>;
  },
  Error
> {
  return tryBlock(
    async function* () {
      const initResponse = yield* makeJSONRPCCall(url, 'initialize', {
        id,
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: 'R-LLM',
            version: '1.0.0'
          }
        }
      }).context('Failed to send initialize request');

      if ('error' in initResponse.result) {
        return AsyncResult.Err(new Error(`MCP server error: ${initResponse.result.error.message}`));
      }

      const initResult = initResponse.result.result;

      const initData = yield* Result.from(
        () => validMcpServerJSONResponses.shape.initialize.parse(initResult),
        (e) => new Error(`MCP server invalid initialize response`, { cause: e })
      );

      const sessionId = extractSessionId(initResponse.response);

      yield* makeJSONRPCCall(url, 'notifications/initialized', {
        extraHeaders: sessionId.match(
          (id) => ({ 'MCP-Session-Id': id }),
          () => ({})
        )
      });

      return AsyncResult.Ok({
        sessionId,
        capabilities: initData.capabilities,
        serverInfo: initData.serverInfo
      });
    },
    (e) => new Error(`Failed to initialize MCP session`, { cause: e })
  );
}

/**
 * Make an MCP call to a specific method
 *
 * @template TMethod - The MCP method name
 * @template TResponse - Expected response type
 * @param config - Call configuration
 * @returns AsyncResult with the response
 */
function makeMCPCall<
  const TMethod extends TValidMcpServerJSONMethods['method'],
  TResponse = TValidMcpServerJSONResponses[`"${TMethod}"`]
>(config: {
  id: string;
  method: TMethod;
  params?: Record<string, unknown>;
  sessionId: null | string;
  url: string;
}): AsyncResult<TResponse, Error | Error> {
  const { id, method, params, sessionId, url } = config;

  const extraHeaders: Record<string, string> = {};
  if (sessionId) {
    extraHeaders['MCP-Session-Id'] = sessionId;
  }

  return makeJSONRPCCall(url, method, {
    id,
    params,
    extraHeaders
  })
    .andThen((value) => {
      if ('error' in value.result) {
        return AsyncResult.Err(new Error(`MCP server error: ${value.result.error.message}`));
      }
      return AsyncResult.Ok(value.result.result);
    })
    .andThen((value) => {
      if (!(method in validMcpServerJSONResponses.shape)) {
        return AsyncResult.Err(new Error(`Response schema not defined for method: ${method}`));
      }

      return AsyncResult.Ok(validMcpServerJSONResponses.shape[method].parse(value) as TResponse);
    })
    .context(`Failed to make MCP call: ${method}`);
}

export { initializeMCPSession, makeMCPCall };
