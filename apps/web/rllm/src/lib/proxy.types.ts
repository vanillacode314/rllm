import type { ConfiguredMiddleware } from 'wretch';

export type TProxyHealthStatus = 'failed' | 'passing' | 'untested';

export interface TProxyManager {
  checkHealth(): Promise<void>;
  getEffectiveProxyUrl(): null | string;
  initialize(): Promise<void>;
  middleware(): ConfiguredMiddleware;
  proxifyUrl(url: string): string;
  readonly proxyHealthStatus: TProxyHealthStatus;
  readonly proxyUrl: null | string;
  subscribe(callback: (status: TProxyHealthStatus) => void): () => void;
  updateProxyUrl(url: null | string): Promise<void>;
}
