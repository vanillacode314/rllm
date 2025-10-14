/**
 * A generic object pool that reuses objects to minimize object creation overhead.
 * It supports a fixed capacity, a factory for creating new objects,
 * and a garbage collection mechanism for unused objects.
 */
export class ObjectPool<T> {
	private pool = new Set<T>();
	private readonly factory: () => T;
	private queuedTasks = new Set<PromiseWithResolvers<T>>();
	private size: number = 0;
	private readonly gcTime: number = 1000 * 60 * 5;
	private gcTimers = new Map<T, ReturnType<typeof setTimeout>>();
	private destroyed = false;

	/**
	 * Creates an instance of ObjectPool.
	 * @param factory A function that creates a new object of type T.
	 * @param capacity The maximum number of objects the pool can hold.
	 * @param gcTime Optional. The time in milliseconds after which an unused object in the pool will be garbage collected. Defaults to 5 minutes.
	 */
	constructor(
		factory: () => T,
		public readonly capacity: number,
		gcTime?: number
	) {
		this.capacity = Math.min(capacity, 1);
		if (gcTime !== undefined && gcTime < 0) {
			throw new Error('GC time must be non-negative');
		}

		this.factory = factory;
		this.gcTime = gcTime ?? this.gcTime;
	}

	/**
	 * Retrieves an object from the pool. If no objects are available and the pool has not reached its capacity,
	 * a new object is created. If the pool is at capacity, it waits for an object to be released.
	 * @param timeoutMs Optional. The maximum time in milliseconds to wait for an object to become available.
	 * If the timeout is reached, a 'Timeout' error is thrown.
	 * @returns A promise that resolves with an object of type T.
	 * @throws Error if pool is destroyed, `timeoutMs` is 0, or if the timeout is reached.
	 */
	get(timeoutMs?: number): Promise<T> | T {
		if (this.destroyed) {
			throw new Error('Pool has been destroyed');
		}

		if (this.pool.size > 0) {
			const obj = this.pool.values().next().value!;
			this.pool.delete(obj);
			this.cancelGCTimer(obj);
			return obj;
		}

		if (this.size < this.capacity) {
			this.size++;
			return this.factory();
		}

		if (timeoutMs === 0) {
			throw new Error('Invalid timeout, must be greater than 0');
		}

		const task = Promise.withResolvers<T>();
		this.queuedTasks.add(task);

		if (timeoutMs) {
			const timeoutId = setTimeout(() => {
				if (this.queuedTasks.delete(task)) {
					task.reject(new Error('Timeout'));
				}
			}, timeoutMs);

			task.promise.finally(() => clearTimeout(timeoutId));
		}

		return task.promise;
	}

	/**
	 * Releases an object back into the pool, making it available for reuse.
	 * If there are pending requests in the queue, the object is immediately provided to the next waiting consumer.
	 * If the pool is at capacity, the object might be subject to garbage collection after `gcTime`.
	 * @param obj The object to release.
	 */
	release(obj: T): void {
		if (this.destroyed) {
			return;
		}

		if (this.queuedTasks.size > 0) {
			const task = this.queuedTasks.values().next().value!;
			this.queuedTasks.delete(task);
			task.resolve(obj);
			return;
		}

		if (this.size <= this.capacity && !this.pool.has(obj)) {
			this.pool.add(obj);

			if (this.gcTime !== Number.POSITIVE_INFINITY) {
				this.scheduleGCTimer(obj);
			}
		}
	}

	/**
	 * Drains all objects from the pool without destroying them.
	 * Useful for testing or resetting the pool state.
	 */
	drain(): void {
		this.pool.clear();
		this.gcTimers.forEach((timer) => clearTimeout(timer));
		this.gcTimers.clear();
		this.size = 0;
	}

	/**
	 * Destroys the pool, clearing all objects and rejecting any pending requests.
	 * Once destroyed, the pool cannot be used again.
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}

		this.destroyed = true;

		// Reject all pending tasks
		this.queuedTasks.forEach((task) => {
			task.reject(new Error('Pool destroyed'));
		});
		this.queuedTasks.clear();

		// Clear all timers
		this.gcTimers.forEach((timer) => clearTimeout(timer));
		this.gcTimers.clear();

		// Clear the pool
		this.pool.clear();
		this.size = 0;
	}

	/**
	 * Returns the current number of available objects in the pool.
	 */
	get available(): number {
		return this.pool.size;
	}

	/**
	 * Returns the current total number of objects (both available and in use).
	 */
	get total(): number {
		return this.size;
	}

	/**
	 * Returns the number of pending requests waiting for an object.
	 */
	get pending(): number {
		return this.queuedTasks.size;
	}

	private cancelGCTimer(obj: T): void {
		const timer = this.gcTimers.get(obj);
		if (timer) {
			clearTimeout(timer);
			this.gcTimers.delete(obj);
		}
	}

	private scheduleGCTimer(obj: T): void {
		this.cancelGCTimer(obj);

		const timer = setTimeout(() => {
			if (this.pool.has(obj)) {
				this.pool.delete(obj);
				this.gcTimers.delete(obj);
				this.size--;
			}
		}, this.gcTime);

		this.gcTimers.set(obj, timer);
	}
}

interface PromiseWithResolvers<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: any) => void;
}
