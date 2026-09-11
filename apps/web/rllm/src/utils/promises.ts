export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T extends Promise<unknown>>(
  promise: T,
  timeout: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError()), timeout);
  });

  return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]) as T;
}
