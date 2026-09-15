import { Event } from 'event-bus';
import type { ConfiguredMiddleware } from 'wretch';

import { PROXY_HEALTH_CHECK_INTERVAL_MS, PROXY_HEALTH_CHECK_TIMEOUT_MS } from '~/constants/proxy';
import { withTimeout } from '~/utils/promises';

export type TProxyHealthStatus = 'failed' | 'passing' | 'unset' | 'untested';

export class ProxyManager {
  static #activeProxyUrl: null | string = null;
  static #healthCheckController: AbortController | null = null;
  static #healthCheckInterval: null | ReturnType<typeof setTimeout> = null;
  static #proxyUrls: string[] = [];
  static #status: TProxyHealthStatus = 'untested';
  static #statusEvent = new Event<TProxyHealthStatus>();

  static async checkHealth(): Promise<void> {
    this.#healthCheckController?.abort();
    const controller = new AbortController();
    this.#healthCheckController = controller;

    if (this.#proxyUrls.length === 0) {
      console.debug('[Proxy] No proxy configured');
      this.#setStatusAndActive('unset', null);
      return;
    }
    const proxyUrls = this.#proxyUrls;
    const results = await Promise.all(
      proxyUrls.map(async (url, index) => {
        const result = await this.#testProxyHealth(url, controller.signal);
        if (!result || controller.signal.aborted) return result;

        const activeProxyUrlIndex = proxyUrls.findIndex(
          (candidate) => candidate === this.#activeProxyUrl
        );
        if (activeProxyUrlIndex >= 0 && activeProxyUrlIndex < index) return result;

        console.debug('[Proxy] Health check result:', url);
        this.#setStatusAndActive('passing', url);
        return result;
      })
    );
    if (controller.signal.aborted) return;

    const healthyIndex = results.indexOf(true);
    const activeProxyUrl = healthyIndex === -1 ? null : proxyUrls[healthyIndex];
    console.debug('[Proxy] Health check result:', activeProxyUrl ?? 'none');
    this.#setStatusAndActive(activeProxyUrl ? 'passing' : 'failed', activeProxyUrl);
    this.#scheduleHealthRecheck();
  }

  static getActiveProxyUrl(): null | string {
    return this.#activeProxyUrl;
  }

  static async initialize(proxyUrls: string[]): Promise<void> {
    this.#proxyUrls = proxyUrls;
    await this.checkHealth();
  }

  static middleware(): ConfiguredMiddleware {
    return (next) => (url, opts) => next(this.proxifyUrl(url), opts);
  }

  static proxifyUrl(url: string): string {
    if (this.#status !== 'passing') return url;
    return this.#activeProxyUrl ? this.#activeProxyUrl.replace('%s', url) : url;
  }

  static subscribe(callback: (status: TProxyHealthStatus) => void) {
    callback(this.#status);
    return this.#statusEvent.subscribe(callback);
  }

  static async updateProxyUrls(proxyUrls: string[]): Promise<void> {
    this.#proxyUrls = proxyUrls;
    this.#status = 'untested';
    this.#activeProxyUrl = null;
    await this.checkHealth();
  }

  static #scheduleHealthRecheck(): void {
    if (this.#healthCheckInterval !== null) clearTimeout(this.#healthCheckInterval);
    this.#healthCheckInterval = setTimeout(
      () => this.checkHealth(),
      PROXY_HEALTH_CHECK_INTERVAL_MS
    );
  }

  static #setStatusAndActive(status: TProxyHealthStatus, activeProxyUrl: null | string): void {
    const changed = this.#status !== status || this.#activeProxyUrl !== activeProxyUrl;
    this.#status = status;
    this.#activeProxyUrl = activeProxyUrl;
    if (changed) this.#statusEvent.emit(status);
  }

  static async #testProxyHealth(proxyUrl: string, signal: AbortSignal): Promise<boolean> {
    const testUrl = proxyUrl.replace('%s', 'https://quad9.net');

    try {
      const response = await withTimeout(
        (requestSignal) => fetch(testUrl, { method: 'HEAD', signal: requestSignal }),
        PROXY_HEALTH_CHECK_TIMEOUT_MS,
        signal
      );

      return (response.status >= 200 && response.status < 400) || response.status === 405;
    } catch (e) {
      if (!signal.aborted) console.debug('[Proxy] Health check failed:', e);
      return false;
    }
  }
}

/**
 * Split a stored `cors-proxy-url` metadata value into an ordered list of proxy URL templates.
 * One URL per line; blank lines are ignored. Legacy single-line values yield a one-element list.
 */
export function parseProxyUrls(raw: null | string): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
