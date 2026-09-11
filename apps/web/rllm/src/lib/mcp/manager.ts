import { ReactiveMap } from '@solid-primitives/map';

import { ProxyManager } from '~/lib/proxy';
import { fetchers } from '~/queries';
import type { TTool } from '~/types';

import type { TMCPClient } from './client';
import { MCPClient } from './client';

export class MCPManager {
  static #clients = new ReactiveMap<string, { client: TMCPClient; id: string }>();

  static getAllClients(): TMCPClient[] {
    return this.#clients
      .values()
      .map(({ client }) => client)
      .toArray();
  }

  /**
   * Get all tools from connected clients
   */
  static async getAllTools(): Promise<TTool[]> {
    const tools: TTool[] = [];
    for (const { client } of this.#clients.values()) {
      if (client.status === 'connected') {
        const clientTools = await client.listTools();
        tools.push(...clientTools);
      }
    }
    return tools;
  }

  static getClient(id: string): TMCPClient | undefined {
    return this.#clients.get(id)?.client;
  }

  /**
   * Initialize or update MCP clients from DB
   * Creates new clients only if they don't exist or URL changed
   */
  static async initialize(): Promise<void> {
    const mcps = await fetchers.mcps.getAllMcps();
    this.#removeInvalidClients(new Set(mcps.map((m) => m.id)));
    for (const mcp of mcps) {
      const url = ProxyManager.proxifyUrl(mcp.url);
      const existingClient = this.#clients.get(mcp.id)?.client;
      if (existingClient) {
        existingClient.url = url;
        continue;
      }
      this.#clients.set(mcp.id, {
        client: new MCPClient(mcp.name, url, mcp.id),
        id: mcp.id
      });
    }
  }

  /**
   * List tools for a specific client and cache them
   */
  static async listToolsForClient(clientId: string): Promise<TTool[]> {
    const client = this.#clients.get(clientId)?.client;
    if (!client || client.status !== 'connected') {
      return [];
    }

    try {
      return await client.listTools();
    } catch {
      client.disconnect();
      return [];
    }
  }

  static #removeInvalidClients(validIds: Set<string>) {
    for (const [id] of this.#clients) {
      if (!validIds.has(id)) {
        this.#clients.get(id)?.client.disconnect();
        this.#clients.delete(id);
      }
    }
  }
}
