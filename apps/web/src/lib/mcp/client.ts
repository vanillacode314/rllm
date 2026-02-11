import { nanoid } from 'nanoid';
import { createSignal, type Signal } from 'solid-js';
import { Option } from 'ts-result-option';

import type { TTool } from '~/types';

import { formatError } from '~/utils/errors';

import type { TToolContent, TToolsCallResult, TToolsListResult } from './types';

import { initializeMCPSession, makeMCPCall } from '.';

interface TMCPClient {
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  disconnect(): void;
  initSession(): Promise<void>;
  listTools(): Promise<TTool[]>;
  name: string;
  get status(): TMCPClientStatus;
  url: string;
}

type TMCPClientStatus = 'connected' | 'connecting' | 'disconnected';

class MCPClient implements TMCPClient {
  get status() {
    return this.#status[0]();
  }

  get url() {
    return this.#url;
  }
  set url(url: string) {
    if (url === this.#url) return;
    this.#url = url;
    if (this.status === 'connected') {
      this.disconnect();
      this.initSession();
    }
  }
  #serverCapabilities: unknown = null;
  #serverInfo: null | { name: string; version: string } = null;
  #sessionId: Option<string> = Option.None();

  #status: Signal<TMCPClientStatus> = createSignal<TMCPClientStatus>('disconnected');

  #url: string;

  constructor(
    public name: string,
    url: string,
    private id: string = nanoid()
  ) {
    this.#url = url;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (this.#sessionId.isNone()) {
      await this.initSession();
    }

    if (this.#sessionId.isNone()) {
      throw new Error('Failed to initialize session');
    }

    const sessionId = this.#sessionId.unwrap();
    const result = await makeMCPCall({
      url: this.url,
      id: this.id,
      sessionId,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    });

    return result.match(
      (value) => {
        const callResult = value as TToolsCallResult;
        return callResult.content
          .map((c: TToolContent) => {
            if (c.type === 'text') {
              return c.text;
            }
            return JSON.stringify(c);
          })
          .join('\n');
      },
      (error) => formatError(error)
    );
  }

  disconnect() {
    this.#sessionId = Option.None();
    this.#serverCapabilities = null;
    this.#serverInfo = null;
    this.setStatus('disconnected');
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): unknown {
    return this.#serverCapabilities;
  }

  /**
   * Get server info
   */
  getServerInfo(): null | { name: string; version: string } {
    return this.#serverInfo;
  }

  /**
   * Get session ID
   */
  getSessionId(): Option<string> {
    return this.#sessionId;
  }

  async initSession(): Promise<void> {
    this.setStatus('connecting');

    const sessionResult = await initializeMCPSession(this.url, this.id);

    if (sessionResult.isErr()) {
      this.setStatus('disconnected');
      throw new Error('Failed to initialize session');
    }

    const { sessionId, capabilities, serverInfo } = sessionResult.unwrap();
    this.#sessionId = sessionId;
    this.#serverCapabilities = capabilities;
    this.#serverInfo = serverInfo;

    this.setStatus(this.#sessionId.isSome() ? 'connected' : 'disconnected');
  }

  async listTools(): Promise<TTool[]> {
    if (this.status !== 'connected') {
      throw new Error('Not connected');
    }

    if (this.#sessionId.isNone()) {
      throw new Error('No session ID');
    }

    const sessionId = this.#sessionId.unwrap();
    const result = await makeMCPCall({
      url: this.url,
      id: this.id,
      sessionId,
      method: 'tools/list'
    });

    const toolsResult = result.unwrap();

    const toolsList = toolsResult as TToolsListResult;

    return toolsList.tools.map((tool) => {
      const handler = this.callTool.bind(this, tool.name);
      return {
        name: `${tool.name}__${this.name}`,
        description: tool.description ?? '',
        jsonSchema: tool.inputSchema,
        handler
      };
    });
  }

  setStatus(status: TMCPClientStatus) {
    this.#status[1](status);
  }
}

export { MCPClient };
export type { TMCPClient, TMCPClientStatus };
