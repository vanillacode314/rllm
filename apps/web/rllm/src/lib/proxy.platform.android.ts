import type { ConfiguredMiddleware } from 'wretch';

export type TProxyHealthStatus = 'failed' | 'passing' | 'untested';

export class ProxyManager {
  static async initialize(): Promise<void> {}
  static middleware = (): ConfiguredMiddleware => (next) => next;
  static proxifyUrl = (url: string) => url;
  // oxlint-disable-next-line no-unused-vars
  static subscribe(callback: (status: TProxyHealthStatus) => void) {}
  // oxlint-disable-next-line no-unused-vars
  static async updateProxyUrl(url: null | string): Promise<void> {}
}
