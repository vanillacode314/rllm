import { AsyncResult, Option } from 'ts-result-option';
import { safeFetch, safeParseJson, tryBlock } from 'ts-result-option/utils';

import type { TTool } from '~/types';

import { ProxyManager } from '~/lib/proxy';

import { MCPClient } from './client';
import {
  type JSONRPCRequestSchema,
  type JSONRPCResponseSchema,
  jsonRpcResponseSchema,
  type SSEEvent
} from './types';

export type TestMCPServerResult =
  | {
      error: string;
      serverInfo: null;
      success: false;
    }
  | {
      serverInfo: null | { name: string; version: string };
      success: true;
      tools: TTool[];
    };

/**
 * Test MCP server by initializing a session and listing tools
 */
interface TestMCPServerOptions {
  name: string;
  url: string;
}

/**
 * JSON-RPC error class
 */
export class JSONRPCError extends Error {
  constructor(
    public message: string,
    public code: number,
    public data?: unknown
  ) {
    super(`${message} (code: ${code})`);
    this.name = 'JSONRPCError';
    Object.setPrototypeOf(this, JSONRPCError.prototype);
  }
}

/**
 * Build headers object with session ID
 */
export function buildSessionHeaders(sessionId: null | string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (sessionId) {
    headers['MCP-Session-Id'] = sessionId;
  }
  return headers;
}

/**
 * Extract MCP session ID from response headers
 */
export function extractSessionId(response: Response): Option<string> {
  // Try different header casing as per spec
  return Option.fromNull(
    response.headers.get('MCP-Session-Id') ||
      response.headers.get('mcp-session-id') ||
      response.headers.get('Mcp-Session-Id')
  );
}

/**
 * Make a JSON-RPC call using Streamable HTTP transport
 *
 * Sends a POST request with Accept header for both JSON and SSE.
 * Handles responses as either JSON or SSE stream.
 */
export function makeJSONRPCCall(
  url: string,
  method: string,
  opts: {
    extraBody?: Record<string, unknown>;
    extraHeaders?: Record<string, unknown>;
    id?: number | string;
    params?: Record<string, unknown>;
  } = {}
): AsyncResult<{ response: Response; result: JSONRPCResponseSchema }, Error | JSONRPCError> {
  const { extraBody = {}, extraHeaders = {}, params, id } = opts;

  return tryBlock(
    async function* () {
      // Build JSON-RPC request body
      const body: JSONRPCRequestSchema = {
        jsonrpc: '2.0',
        method,
        id,
        params,
        ...extraBody
      };

      // Send POST request with Streamable HTTP headers
      const fetchResult = yield* safeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...extraHeaders
        },
        body: JSON.stringify(body)
      }).context('Error while making JSON-RPC call');

      const response = fetchResult;

      // Handle 202 Accepted (for notifications)
      if (response.status === 202) {
        return AsyncResult.Ok({
          response,
          result: { jsonrpc: '2.0', id: id } as JSONRPCResponseSchema
        });
      }

      // Check for error status
      if (!response.ok) {
        const errorText = yield* AsyncResult.from(
          () => response.text(),
          (e) => new Error(`Failed to read error response`, { cause: e })
        );
        return AsyncResult.Err(new Error(`HTTP error ${response.status}: ${errorText}`));
      }

      // Get content type
      const contentType = yield* Option.fromNull(response.headers.get('Content-Type'))
        .okOrElse(() => new Error('Content-Type header is missing'))
        .context('Missing Content-Type header');

      const isEventStream = contentType.includes('text/event-stream');
      const isJson = contentType.includes('application/json');

      let jsonResponse: JSONRPCResponseSchema;

      if (isJson) {
        const text = yield* AsyncResult.from(
          () => response.text(),
          (e) => new Error(`Error reading response body`, { cause: e })
        );

        const parseResult = yield* safeParseJson(text, {
          validate: jsonRpcResponseSchema.parse
        }).context('Error parsing JSON-RPC response');

        jsonResponse = parseResult;
      } else if (isEventStream) {
        const text = yield* AsyncResult.from(
          () => response.text(),
          (e) => new Error(`Error reading SSE stream`, { cause: e })
        );

        const events = parseSSEEvents(text);

        // TODO: optimize double parsing later
        const responseEvent = events.find((event) =>
          safeParseJson(event.data, { validate: jsonRpcResponseSchema.parse }).mapOr(
            false,
            (data) => data.jsonrpc === '2.0' && (data.id === id || data.id === Number(id))
          )
        );

        if (!responseEvent) {
          return AsyncResult.Err(new Error('No JSON-RPC response found in SSE stream'));
        }

        const parseResult = yield* safeParseJson(responseEvent.data, {
          validate: (data) => jsonRpcResponseSchema.parse(data)
        }).context('Error parsing JSON-RPC response from SSE');

        jsonResponse = parseResult;
      } else {
        return AsyncResult.Err(new Error(`Unsupported content type: ${contentType}`));
      }

      if ('error' in jsonResponse) {
        return AsyncResult.Err(
          new JSONRPCError(
            jsonResponse.error.message,
            jsonResponse.error.code,
            jsonResponse.error.data
          )
        );
      }

      return AsyncResult.Ok({ response, result: jsonResponse });
    },
    (e) =>
      new Error(`JSON-RPC call failed: ${e instanceof Error ? e.message : 'Unknown error'}`, {
        cause: e
      })
  );
}

export async function testMCPServer(options: TestMCPServerOptions): Promise<TestMCPServerResult> {
  const { name, url } = options;
  const client = new MCPClient(name, ProxyManager.proxifyUrl(url));

  try {
    await client.initSession();
    const tools = await client.listTools();
    const serverInfo = client.getServerInfo();
    client.disconnect();

    return {
      success: true,
      serverInfo,
      tools
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      success: false,
      serverInfo: null,
      error: errorMessage
    };
  }
}

/**
 * Parse SSE event stream into individual events
 */
function parseSSEEvents(input: string): SSEEvent[] {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const events: SSEEvent[] = [];
  let currentEvent: SSEEvent = { data: '' };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      if (currentEvent.data !== '') {
        events.push(currentEvent);
        currentEvent = { data: '' };
      }
      continue;
    }

    if (trimmedLine.startsWith(':')) {
      continue;
    }

    if (trimmedLine.startsWith('data:')) {
      const dataContent = trimmedLine.slice(5).trimStart();
      if (dataContent === '') continue;
      if (currentEvent.data === '') {
        currentEvent.data = dataContent;
      } else {
        currentEvent.data += '\n' + dataContent;
      }
      continue;
    }

    if (trimmedLine.startsWith('event:')) {
      const eventName = trimmedLine.slice(6).trim();
      if (eventName !== '') {
        currentEvent.event = eventName;
      }
      continue;
    }

    if (trimmedLine.startsWith('id:')) {
      const id = trimmedLine.slice(3).trim();
      currentEvent.id = id;
      continue;
    }

    if (currentEvent.data !== '') {
      events.push(currentEvent);
      currentEvent = { data: '' };
    }
  }

  if (currentEvent.data !== '') {
    events.push(currentEvent);
  }

  return events;
}
