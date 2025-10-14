import { type } from 'arktype';

const jsonRpcResponseSchema = type({
	jsonrpc: '"2.0"',
	id: 'string',
	result: 'unknown'
}).or({
	jsonrpc: '"2.0"',
	id: 'string',
	error: {
		code: 'number',
		message: 'string',
		'data?': 'unknown'
	}
});
type TJSONRPCResponse = typeof jsonRpcResponseSchema.infer;

const mcpServerSchema = type({
	id: 'string',
	name: 'string',
	url: 'string.url'
});
type TMCPServerSchema = typeof mcpServerSchema.infer;

const validMcpServerJSONMethods = type({
	method: '"tools/list"',
	params: [{ 'cursor?': 'string' }, '?']
}).or({
	method: '"tools/call"',
	params: {
		name: 'string',
		arguments: 'Record<string, unknown>'
	}
});
type TValidMcpServerJSONMethods = typeof validMcpServerJSONMethods.infer;

const validMcpServerJSONResponses = type({
	'"tools/list"': {
		tools: type({
			name: 'string',
			description: 'string',
			inputSchema: 'Record<string ,unknown>'
		}).array(),
		'nextPageCursor?': 'string'
	},
	'"tools/call"': {
		content: type({
			type: "'text'",
			text: 'string'
		})
			.or({
				type: "'image' | 'audio'",
				data: 'string',
				mimeType: 'string'
			})
			.or({
				type: "'resource'",
				resource: {
					uri: 'string',
					mimeType: 'string',
					text: 'string'
				}
			})
			.array(),
		'isError?': 'boolean',
		'success?': 'boolean'
	}
});

type TValidMcpServerJSONResponses = typeof validMcpServerJSONResponses.infer;

export {
	jsonRpcResponseSchema,
	mcpServerSchema,
	validMcpServerJSONMethods,
	validMcpServerJSONResponses
};
export type {
	TJSONRPCResponse,
	TMCPServerSchema,
	TValidMcpServerJSONMethods,
	TValidMcpServerJSONResponses
};
