export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Run `fn` with a signal that is aborted (and rejects with a `TimeoutError`) once `timeout`
 * elapses. `signal` is forwarded to `fn` through that signal, so callers can cancel `fn` from the
 * outside; `fn` must observe the signal it is given to be cancellable.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeout: number,
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new TimeoutError();
      controller.abort(error);
      reject(error);
    }, timeout);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
    signal?.removeEventListener('abort', abort);
  }
}
