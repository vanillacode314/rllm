function createWorkerPool<T>(init: () => T, size: number = 1) {
	size = Math.max(1, size);
	const workers: T[] = [];

	for (let i = 0; i < size; i++) {
		workers.push(init());
	}

	const taskQueue: {
		reject: (error: unknown) => void;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		resolve: (result: any) => void;
		task: (worker: T) => Promise<unknown>;
	}[] = [];

	const processTaskQueue = () => {
		while (workers.length > 0 && taskQueue.length > 0) {
			const worker = workers.pop()!; // Get an idle worker
			const { task, resolve, reject } = taskQueue.shift()!; // Get next task

			task(worker)
				.then(resolve)
				.catch(reject)
				.finally(() => {
					workers.push(worker);
					processTaskQueue();
				});
		}
	};

	return {
		runTask<U>(task: (worker: T) => Promise<U>): Promise<U> {
			const { promise, resolve, reject } = Promise.withResolvers<U>();
			taskQueue.push({ task, resolve, reject });
			processTaskQueue();
			return promise;
		}
	};
}

export { createWorkerPool };
