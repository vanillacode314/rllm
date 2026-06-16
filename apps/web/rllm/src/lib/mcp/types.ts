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
  id: z.optional(z.union([z.string(), z.number()])),
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.optional(z.unknown())
});

export type JSONRPCRequestSchema = z.infer<typeof jsonRpcRequestSchema>;

export const jsonRpcResponseSchema = z.union([
  z.object({
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0'),
    result: z.unknown()
  }),
  z.object({
    error: z.object({
      code: z.number(),
      data: z.optional(z.unknown()),
      message: z.string()
    }),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
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
      capabilities: z.unknown(),
      clientInfo: z.object({ name: z.string(), version: z.string() }),
      protocolVersion: z.string()
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
      argument: z.object({ value: z.string() }),
      ref: z.unknown()
    })
  }),
  z.object({
    method: z.literal('notifications/initialized'),
    params: z.unknown()
  }),
  z.object({
    method: z.literal('tools/call'),
    params: z.object({
      arguments: z.record(z.string(), z.unknown()),
      name: z.string()
    })
  }),
  z.object({
    method: z.literal('prompts/get'),
    params: z.object({
      arguments: z.optional(z.record(z.string(), z.string())),
      name: z.string()
    })
  })
]);

export type TValidMcpServerJSONMethods = z.infer<typeof validMcpServerJSONMethods>;

/**
 * Valid MCP server JSON-RPC response schemas
 */
export const validMcpServerJSONResponses = z.object({
  'completion/complete': z.object({
    completion: z.object({
      hasMore: z.optional(z.boolean()),
      total: z.optional(z.number()),
      values: z.array(z.string())
    })
  }),
  initialize: z.object({
    capabilities: z.unknown(),
    instructions: z.optional(z.string()),
    protocolVersion: z.string(),
    serverInfo: z.object({ name: z.string(), version: z.string() })
  }),
  'notifications/initialized': z.void(),
  ping: z.object({}),
  'prompts/get': z.object({
    prompt: z.object({
      description: z.optional(z.string()),
      messages: z.array(
        z.object({
          content: z.unknown(),
          role: z.union([z.literal('user'), z.literal('assistant')])
        })
      ),
      name: z.string()
    })
  }),
  'prompts/list': z.object({
    nextPageCursor: z.optional(z.string()),
    prompts: z.array(
      z.object({
        arguments: z.array(
          z.object({
            description: z.optional(z.string()),
            name: z.string(),
            required: z.optional(z.boolean())
          })
        ),
        description: z.optional(z.string()),
        name: z.string()
      })
    )
  }),
  'resources/list': z.object({
    nextPageCursor: z.optional(z.string()),
    resources: z.array(
      z.object({
        description: z.optional(z.string()),
        mimeType: z.optional(z.string()),
        name: z.string(),
        uri: z.string()
      })
    )
  }),
  'resources/read': z.object({
    resources: z.array(
      z.object({
        mimeType: z.optional(z.string()),
        name: z.optional(z.string()),
        text: z.optional(z.string()),
        uri: z.string()
      })
    )
  }),
  'tools/call': z.object({
    content: z.array(
      z.union([
        z.object({ text: z.string(), type: z.literal('text') }),
        z.object({
          data: z.string(),
          mimeType: z.string(),
          type: z.union([z.literal('image'), z.literal('audio')])
        }),
        z.object({
          resource: z.object({
            mimeType: z.string(),
            text: z.optional(z.string()),
            uri: z.string()
          }),
          type: z.literal('resource')
        })
      ])
    ),
    isError: z.optional(z.boolean()),
    success: z.optional(z.boolean())
  }),
  'tools/list': z.object({
    nextPageCursor: z.optional(z.string()),
    tools: z.array(
      z.object({
        description: z.optional(z.string()),
        inputSchema: z.record(z.string(), z.unknown()),
        name: z.string()
      })
    )
  })
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
