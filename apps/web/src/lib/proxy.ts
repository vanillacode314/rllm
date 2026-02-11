import type { ConfiguredMiddleware } from 'wretch';

import { createSignal } from 'solid-js';

import { PROXY_HEALTH_CHECK_INTERVAL_MS, PROXY_HEALTH_CHECK_TIMEOUT_MS } from '~/constants/proxy';
import { fetchers } from '~/queries';

export type TProxyHealthStatus = 'failed' | 'passing' | 'untested';

export class ProxyManager {
  static get proxyHealthStatus() {
    return this.#status[0];
  }
  static get proxyUrl() {
    return this.#proxyUrl[0];
  }
  static #healthCheckInterval: null | ReturnType<typeof setTimeout> = null;
  static #proxyUrl = createSignal<null | string>(null);
  static #status = createSignal<TProxyHealthStatus>('untested');
  static #subscribers = new Set<(status: TProxyHealthStatus) => void>();

  static async checkHealth(): Promise<void> {
    const proxy = this.#proxyUrl[0]();
    if (!proxy) {
      console.debug('[Proxy] No proxy configured');
      this.#status[1]('passing');
      return;
    }
    const isHealthy = await this.#testProxyHealth(proxy);
    console.debug('[Proxy] Health check result:', isHealthy ? 'passing' : 'failed');
    this.#status[1](isHealthy ? 'passing' : 'failed');
    for (const subscriber of this.#subscribers) {
      subscriber(this.#status[0]());
    }
    this.#scheduleHealthRecheck();
  }
  static getEffectiveProxyUrl(): null | string {
    if (this.#status[0]() === 'failed') return null;
    return this.#proxyUrl[0]();
  }

  static async initialize(): Promise<void> {
    const url = await fetchers.userMetadata.byId('cors-proxy-url');
    this.#proxyUrl[1](url);
    await this.checkHealth();
  }

  static middleware(): ConfiguredMiddleware {
    return (next) => (url, opts) => next(this.proxifyUrl(url), opts);
  }

  static proxifyUrl(url: string): string {
    const proxy = this.getEffectiveProxyUrl();
    return proxy ? proxy.replace('%s', url) : url;
  }

  static subscribe(callback: (status: TProxyHealthStatus) => void) {
    this.#subscribers.add(callback);
    callback(this.#status[0]());
    return () => this.#subscribers.delete(callback);
  }

  static async updateProxyUrl(url: null | string): Promise<void> {
    this.#proxyUrl[1](url);
    this.#status[1]('untested');
    await this.checkHealth();
  }

  static #scheduleHealthRecheck(): void {
    if (this.#healthCheckInterval !== null) clearTimeout(this.#healthCheckInterval);
    this.#healthCheckInterval = setTimeout(
      () => this.checkHealth(),
      PROXY_HEALTH_CHECK_INTERVAL_MS
    );
  }

  static async #testProxyHealth(proxyUrl: string): Promise<boolean> {
    const testUrl = proxyUrl.replace('%s', 'https://quad9.net');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort('Timeout'), PROXY_HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(testUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);

      return (response.status >= 200 && response.status < 400) || response.status === 405;
    } catch (e) {
      console.debug('[Proxy] Health check failed:', e);
      return false;
    }
  }
}
