import type { ConfiguredMiddleware } from 'wretch';

import { PROXY_HEALTH_CHECK_INTERVAL_MS, PROXY_HEALTH_CHECK_TIMEOUT_MS } from '~/constants/proxy';
import { Event } from 'event-bus';

export type TProxyHealthStatus = 'failed' | 'passing' | 'untested' | 'unset';

export class ProxyManager {
  static #healthCheckInterval: null | ReturnType<typeof setTimeout> = null;
  static #proxyUrl: null | string = null;
  static #status: TProxyHealthStatus = 'untested';
  static #statusEvent = new Event<TProxyHealthStatus>();

  static async checkHealth(): Promise<void> {
    if (!this.#proxyUrl) {
      console.debug('[Proxy] No proxy configured');
      this.#status = 'unset';
      return;
    }
    const isHealthy = await this.#testProxyHealth(this.#proxyUrl);
    console.debug('[Proxy] Health check result:', isHealthy ? 'passing' : 'failed');
    const oldStatus = this.#status;
    this.#status = isHealthy ? 'passing' : 'failed';
    if (oldStatus !== this.#status) {
      this.#statusEvent.emit(this.#status);
    }
    this.#scheduleHealthRecheck();
  }

  static async initialize(proxyUrl: string | null): Promise<void> {
    this.#proxyUrl = proxyUrl;
    await this.checkHealth();
  }

  static middleware(): ConfiguredMiddleware {
    return (next) => (url, opts) => next(this.proxifyUrl(url), opts);
  }

  static proxifyUrl(url: string): string {
    if (this.#status !== 'passing') return url;
    return this.#proxyUrl ? this.#proxyUrl.replace('%s', url) : url;
  }

  static subscribe(callback: (status: TProxyHealthStatus) => void) {
    callback(this.#status);
    return this.#statusEvent.subscribe(callback);
  }

  static async updateProxyUrl(url: null | string): Promise<void> {
    this.#proxyUrl = url;
    this.#status = 'untested';
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
