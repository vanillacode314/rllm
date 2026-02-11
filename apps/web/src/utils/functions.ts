interface CacheEntry<T> {
	timestamp: number;
	value: T;
}

interface LRUCacheOptions {
	maxSize?: number;
	ttlMs?: number;
}

function once<Fn extends (...args: unknown[]) => unknown>(fn: Fn): Fn {
	let called = false;
	let result: ReturnType<Fn>;
	return function (...args) {
		if (!called) {
			called = true;
			result = fn.call(this, ...args) as never;
		}
		return result;
	} as Fn;
}

function withLruCache<T extends (...args: any[]) => any>(
	fn: T,
	options: LRUCacheOptions = {}
): (...args: Parameters<T>) => ReturnType<T> {
	const { maxSize = 100, ttlMs } = options;
	const cache = new Map<string, CacheEntry<ReturnType<T>>>();

	return function (...args: Parameters<T>): ReturnType<T> {
		const key = JSON.stringify(args);
		const now = Date.now();

		if (cache.has(key)) {
			const entry = cache.get(key)!;

			if (ttlMs && now - entry.timestamp > ttlMs) {
				cache.delete(key);
			} else {
				entry.timestamp = now;
				return entry.value;
			}
		}

		const result = fn(...args) as never;

		if (cache.size >= maxSize) {
			let oldestKey = '';
			let oldestTime = Infinity;
			for (const [k, v] of cache.entries()) {
				if (v.timestamp < oldestTime) {
					oldestTime = v.timestamp;
					oldestKey = k;
				}
			}
			cache.delete(oldestKey);
		}

		cache.set(key, { value: result, timestamp: now });
		return result;
	};
}

export { once, withLruCache };
