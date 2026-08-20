export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T extends Promise<unknown>>(promise: T, timeout: number): T {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError()), timeout);
  });

  return Promise.race([promise, timeoutPromise]) as T;
}
