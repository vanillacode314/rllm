interface CacheEntry<T> {
	timestamp: number;
	value: T;
}

interface LRUCacheOptions {
	maxSize?: number;
	ttl?: number;
}

function once<Fn extends (...args: never[]) => never>(fn: Fn): Fn {
	let called = false;
	let result: ReturnType<Fn>;
	return function (...args) {
		if (!called) {
			called = true;
			result = fn(...args);
		}
		return result;
	} as Fn;
}

function withLruCache<T extends (...args: never[]) => never>(
	fn: T,
	options: LRUCacheOptions = {}
): (...args: Parameters<T>) => ReturnType<T> {
	const { maxSize = 100, ttl } = options;
	const cache = new Map<string, CacheEntry<ReturnType<T>>>();

	return function (...args: Parameters<T>): ReturnType<T> {
		const key = JSON.stringify(args);
		const now = Date.now();

		if (cache.has(key)) {
			const entry = cache.get(key)!;

			if (ttl && now - entry.timestamp > ttl) {
				cache.delete(key);
			} else {
				entry.timestamp = now;
				return entry.value;
			}
		}

		const result = fn(...args);

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
