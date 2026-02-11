import Ajv from 'ajv';
import { type } from 'arktype';
import betterAjvErrors from 'better-ajv-errors';
import { nanoid } from 'nanoid';
import { createSignal, type Signal } from 'solid-js';
import { Option } from 'ts-result-option';

import type { TTool } from '~/types';

import { formatError } from '~/utils/errors';

import { initializeMCPSession, makeMCPCall } from '.';

const ajv = new Ajv({ allErrors: true });

interface TMCPClient {
	callTool(name: string, args: Record<string, unknown>): Promise<string>;
	disconnect(): void;
	initSession(): Promise<void>;
	listTools(): Promise<TTool[]>;
	name: string;
	url: string;
}
type TMCPClientStatus = 'connected' | 'connecting' | 'disconnected';

class MCPClient implements TMCPClient {
	get status() {
		return this.#status[0]();
	}

	#status: Signal<TMCPClientStatus> = createSignal<TMCPClientStatus>('disconnected');

	constructor(
		public name: string,
		public url: string,
		private id: string = nanoid(),
		private sessionId: Option<string> = Option.None()
	) {}

	async callTool(name: string, args: Record<string, unknown>) {
		if (this.sessionId.isNone()) {
			await this.initSession();
		}
		if (this.sessionId.isNone()) throw new Error('Failed to initialize session');
		const sessionId = this.sessionId.unwrap();
		const result = makeMCPCall({
			url: this.url,
			id: this.id,
			sessionId,
			method: 'tools/call',
			params: {
				name: name,
				arguments: args
			}
		});
		return await result.match(
			(value) => value.content.map((c) => c.text).join('\n'),
			(error) => formatError(error)
		);
	}

	disconnect() {
		this.sessionId = Option.None();
		this.#status[1]('disconnected');
	}

	async initSession() {
		this.#status[1]('connecting');
		const sessionIdResult = await initializeMCPSession(this.url, this.id)
			.ok()
			.then((option) => option.flatten());
		this.sessionId = sessionIdResult;
		this.#status[1](sessionIdResult.isSome() ? 'connected' : 'disconnected');
	}

	async listTools(): Promise<TTool[]> {
		if (this.status !== 'connected') throw new Error('Not connected');
		const sessionId = this.sessionId.unwrap();
		const { tools } = await makeMCPCall({
			url: this.url,
			id: this.id,
			sessionId,
			method: 'tools/list'
		}).unwrap();
		return tools.map((tool) => {
			const validate = ajv.compile(tool.inputSchema);
			return {
				name: `${tool.name}__${this.name}`,
				description: tool.description,
				schema: Object.assign(
					type('unknown').narrow((value, ctx) => {
						const valid = validate(value);
						if (!valid)
							return ctx.reject({
								problem: betterAjvErrors(tool.inputSchema, value, validate.errors)
							});

						return true;
					}),
					{ toJsonSchema: () => tool.inputSchema }
				),
				handler: this.callTool.bind(this, tool.name)
			};
		});
	}
}

export { MCPClient };
