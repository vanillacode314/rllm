import { createConnectivitySignal } from '@solid-primitives/connectivity';
import { createPageVisibility } from '@solid-primitives/page-visibility';
import { createScheduled, debounce } from '@solid-primitives/scheduled';
import {
	batch,
	createComputed,
	createEffect,
	createMemo,
	createResource,
	onCleanup,
	onMount,
	type Signal,
	untrack
} from 'solid-js';
import { createStore } from 'solid-js/store';

const isOnline = createConnectivitySignal();
const pageVisible = createPageVisibility();

function createDebouncedMemo<T>(
	fn: (p: T | undefined) => T,
	value: NoInfer<T>,
	options?: NoInfer<{
		duration?: number;
		equals?: ((prev: T, next: T) => boolean) | false;
		name?: string;
	}>
) {
	const scheduled = createScheduled((fn) => debounce(fn, options?.duration ?? 1000));
	return createMemo((value) => (scheduled() ? fn(value) : value), value, options);
}

function createLatestAsync<T, S>(source: () => S, fetcher: (source: S) => Promise<T>) {
	const [state, setState] = createStore<{
		error: unknown;
		finishedAt: number;
		pending: boolean;
		startedAt: number;
	}>({
		pending: false,
		error: undefined,
		startedAt: Date.now(),
		finishedAt: Date.now()
	});
	const [data, { mutate }] = createResource(
		() => ({ source: untrack(source), error: state.error }),
		({ source, error }) => {
			if (error !== undefined) throw error;
			return fetcher(source);
		}
	);

	let firstRun = true;
	createComputed(() => {
		const $source = source();
		if (firstRun) {
			firstRun = false;
			return;
		}
		untrack(async () => {
			const startedAt = Date.now();
			setState({ pending: true, startedAt });
			try {
				const value = await fetcher($source);
				const finishedAt = Date.now();
				if (state.finishedAt > finishedAt) return;

				batch(() => {
					mutate(value);
					setState({ error: undefined, finishedAt });

					if (state.startedAt > startedAt) return;
					setState({ pending: false });
				});
			} catch (error) {
				if (state.startedAt > startedAt) return;
				const finishedAt = Date.now();
				setState({ error: error, finishedAt });
			}
		});
	});
	return [() => data(), () => data.state === 'pending' || state.pending] as const;
}

function syncToURLHash(signal: Signal<boolean>, key: string): Signal<boolean> {
	key = '#' + key;
	const s = createMemo(signal[0]);
	const set = signal[1];

	function updateSignalOnURLHashChange() {
		set(window.location.hash === key);
	}
	onMount(() => {
		if (window.location.hash === key) {
			window.history.replaceState({}, document.title, window.location.href.replace(/#.*$/g, ''));
		}
		window.addEventListener('hashchange', updateSignalOnURLHashChange);
		onCleanup(() => window.removeEventListener('hashchange', updateSignalOnURLHashChange));
	});

	function updateURLHashOnSignalChange() {
		const v = s();
		untrack(() => {
			if (v) {
				window.location.hash = key;
			} else if (window.location.hash === key) {
				window.history.replaceState({}, document.title, window.location.href.replace(/#.*$/g, ''));
			}
		});
	}
	createEffect(updateURLHashOnSignalChange);

	return [s, set];
}

export { createDebouncedMemo, createLatestAsync, isOnline, pageVisible, syncToURLHash };
