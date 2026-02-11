import * as z from 'zod/mini';

/**
 * JSON-RPC Error Codes
 * @see https://www.jsonrpc.org/specification#error_object
 */
export const JSONRPC_PARSE_ERROR = -32700;
export const JSONRPC_INVALID_REQUEST = -32600;
export const JSONRPC_METHOD_NOT_FOUND = -32601;
export const JSONRPC_INVALID_PARAMS = -32602;
export const JSONRPC_INTERNAL_ERROR = -32603;

/**
 * MCP-specific error code for URL elicitation
 * @see https://github.com/modelcontextprotocol/specification/blob/main/schema/2025-11-25/schema.ts
 */
export const URL_ELICITATION_REQUIRED = -32042;

/**
 * Latest MCP protocol version
 */
export const MCP_PROTOCOL_VERSION = '2025-11-25';

export interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
}

// =============================================================================
// Type Schemas for Validation (Arktype)
// =============================================================================

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.optional(z.unknown()),
  id: z.optional(z.union([z.string(), z.number()]))
});

export type JSONRPCRequestSchema = z.infer<typeof jsonRpcRequestSchema>;

export const jsonRpcResponseSchema = z.union([
  z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]),
    result: z.unknown()
  }),
  z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]),
    error: z.object({
      code: z.number(),
      message: z.string(),
      data: z.optional(z.unknown())
    })
  })
]);

export type JSONRPCResponseSchema = z.infer<typeof jsonRpcResponseSchema>;

export const mcpServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.url()
});

export type TMCPServerSchema = z.infer<typeof mcpServerSchema>;

/**
 * Valid MCP server JSON-RPC methods (client-initiated)
 */
export const validMcpServerJSONMethods = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('initialize'),
    params: {
      protocolVersion: z.string(),
      capabilities: z.unknown(),
      clientInfo: z.object({ name: z.string(), version: z.string() })
    }
  }),
  z.object({
    method: z.literal('ping'),
    params: z.unknown()
  }),
  z.object({
    method: z.literal('tools/list'),
    params: z.union([z.object({ cursor: z.string() }), z.undefined()])
  }),
  z.object({
    method: z.literal('resources/list'),
    params: z.union([z.object({ cursor: z.string() }), z.undefined()])
  }),
  z.object({
    method: z.literal('resources/read'),
    params: z.object({ uri: z.string() })
  }),
  z.object({
    method: z.literal('prompts/list'),
    params: z.union([z.object({ cursor: z.string() }), z.undefined()])
  }),
  z.object({
    method: z.literal('completion/complete'),
    params: z.object({
      ref: z.unknown(),
      argument: z.object({ value: z.string() })
    })
  }),
  z.object({
    method: z.literal('notifications/initialized'),
    params: z.unknown()
  }),
  z.object({
    method: z.literal('tools/call'),
    params: z.object({
      name: z.string(),
      arguments: z.record(z.string(), z.unknown())
    })
  }),
  z.object({
    method: z.literal('prompts/get'),
    params: z.object({
      name: z.string(),
      arguments: z.optional(z.record(z.string(), z.string()))
    })
  })
]);

export type TValidMcpServerJSONMethods = z.infer<typeof validMcpServerJSONMethods>;

/**
 * Valid MCP server JSON-RPC response schemas
 */
export const validMcpServerJSONResponses = z.object({
  initialize: z.object({
    protocolVersion: z.string(),
    capabilities: z.unknown(),
    serverInfo: z.object({ name: z.string(), version: z.string() }),
    instructions: z.optional(z.string())
  }),
  ping: z.object({}),
  'tools/list': z.object({
    tools: z.array(
      z.object({
        name: z.string(),
        description: z.optional(z.string()),
        inputSchema: z.record(z.string(), z.unknown())
      })
    ),
    nextPageCursor: z.optional(z.string())
  }),
  'tools/call': z.object({
    content: z.array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({
          type: z.union([z.literal('image'), z.literal('audio')]),
          data: z.string(),
          mimeType: z.string()
        }),
        z.object({
          type: z.literal('resource'),
          resource: z.object({
            uri: z.string(),
            mimeType: z.string(),
            text: z.optional(z.string())
          })
        })
      ])
    ),
    isError: z.optional(z.boolean()),
    success: z.optional(z.boolean())
  }),
  'resources/list': z.object({
    resources: z.array(
      z.object({
        uri: z.string(),
        name: z.string(),
        mimeType: z.optional(z.string()),
        description: z.optional(z.string())
      })
    ),
    nextPageCursor: z.optional(z.string())
  }),
  'resources/read': z.object({
    resources: z.array(
      z.object({
        uri: z.string(),
        name: z.optional(z.string()),
        mimeType: z.optional(z.string()),
        text: z.optional(z.string())
      })
    )
  }),
  'prompts/list': z.object({
    prompts: z.array(
      z.object({
        name: z.string(),
        description: z.optional(z.string()),
        arguments: z.array(
          z.object({
            name: z.string(),
            description: z.optional(z.string()),
            required: z.optional(z.boolean())
          })
        )
      })
    ),
    nextPageCursor: z.optional(z.string())
  }),
  'prompts/get': z.object({
    prompt: z.object({
      name: z.string(),
      description: z.optional(z.string()),
      messages: z.array(
        z.object({
          role: z.union([z.literal('user'), z.literal('assistant')]),
          content: z.unknown()
        })
      )
    })
  }),
  'completion/complete': z.object({
    completion: z.object({
      values: z.array(z.string()),
      total: z.optional(z.number()),
      hasMore: z.optional(z.boolean())
    })
  }),
  'notifications/initialized': z.void()
});

export type TInitializeResult = TValidMcpServerJSONResponses['initialize'];
export type TToolContent = TValidMcpServerJSONResponses['tools/call']['content'][number];
export interface TToolsCallResult {
  content: TToolContent[];
  isError?: boolean;
  success?: boolean;
}
export type TToolsListResult = TValidMcpServerJSONResponses['tools/list'];
export type TValidMcpServerJSONResponses = z.infer<typeof validMcpServerJSONResponses>;
