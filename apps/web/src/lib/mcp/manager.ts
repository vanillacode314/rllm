import { ReactiveMap } from '@solid-primitives/map';

import type { TTool } from '~/types';

import { ProxyManager } from '~/lib/proxy';
import { fetchers } from '~/queries';

import type { TMCPClient } from './client';

import { MCPClient } from './client';

export class MCPManager {
  static #clients = new ReactiveMap<string, { client: TMCPClient; id: string }>();

  /**
   * Disconnect all clients
   */
  static disconnectAll(): void {
    for (const { client } of this.#clients.values()) {
      client.disconnect();
    }
  }

  /**
   * Get all clients
   */
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

  /**
   * Get client by ID
   */
  static getClient(id: string): TMCPClient | undefined {
    return this.#clients.get(id)?.client;
  }

  /**
   * Get client by name (first match)
   */
  static getClientByName(name: string): TMCPClient | undefined {
    for (const { client } of this.#clients.values()) {
      if (client.name === name) return client;
    }
    return undefined;
  }

  /**
   * Get only connected clients
   */
  static getConnectedClients(): TMCPClient[] {
    return this.#clients
      .values()
      .filter(({ client }) => client.status === 'connected')
      .map(({ client }) => client)
      .toArray();
  }

  /**
   * Initialize session for all clients
   */
  static async initAll(): Promise<void> {
    ProxyManager.subscribe(() => this.initialize());

    const initPromises: Promise<void>[] = [];
    for (const { client } of this.#clients.values()) {
      initPromises.push(client.initSession().catch(() => {}));
    }
    await Promise.all(initPromises);
  }

  /**
   * Initialize session for a specific client
   */
  static async initClient(clientId: string): Promise<void> {
    const client = this.#clients.get(clientId)?.client;
    if (!client) return;
    await client.initSession();
  }

  /**
   * Initialize or update MCP clients from DB
   * Creates new clients only if they don't exist or URL changed
   */
  static async initialize(): Promise<void> {
    const mcps = await fetchers.mcps.getAllMcps();

    // Remove invalid clients
    const validIds = new Set(mcps.map((m) => m.id));
    for (const [id] of this.#clients) {
      if (!validIds.has(id)) {
        this.#clients.get(id)?.client.disconnect();
        this.#clients.delete(id);
      }
    }
    // Create new or update existing clients
    for (const mcp of mcps) {
      const url = ProxyManager.proxifyUrl(mcp.url);
      const existingClient = this.#clients.get(mcp.id)?.client;
      if (existingClient && url !== existingClient.url) {
        existingClient.disconnect();
        existingClient.url = url;
        existingClient.initSession();
      } else {
        this.#clients.set(mcp.id, {
          id: mcp.id,
          client: new MCPClient(mcp.name, url, mcp.id)
        });
      }
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
}
