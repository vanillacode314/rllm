import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createTimeoutLoop } from '@solid-primitives/timer';
import { debounce } from '@tanstack/solid-pacer';
import { type Accessor, createRenderEffect, createSignal, on, onMount } from 'solid-js';

export function useAutoScroll(
	options: {
		enabled?: Accessor<boolean>;
		threshold?: number;
	} = {}
) {
	const { enabled = () => true, threshold = 50 } = options;
	const [shouldAutoScroll, setShouldAutoScroll] = createSignal<boolean>(true);
	let autoScrolling = false;

	let _ref: HTMLElement;
	const scrollToBottom = debounce(
		(force: boolean = false) => {
			if (!_ref) {
				console.warn('useAutoScroll: ref is not defined');
				return;
			}
			if (!force) {
				if (!enabled()) return;
				if (!shouldAutoScroll()) return;
			} else setShouldAutoScroll(true);
			_ref.addEventListener('scrollend', () => (autoScrolling = false));
			autoScrolling = true;
			_ref.scrollTo({ behavior: 'smooth', top: _ref.scrollHeight });
		},
		{
			wait: 16
		}
	);
	const autoScroll = (ref: HTMLElement) => {
		_ref = ref;
		const [height, setHeight] = createSignal(0);

		createTimeoutLoop(() => {
			setHeight(ref.scrollHeight);
		}, 100);

		createRenderEffect(
			on(height, () => {
				if (!shouldAutoScroll()) return;
				scrollToBottom();
			})
		);
		onMount(() => {
			createEventListenerMap(
				ref,
				{
					scroll: () => {
						if (autoScrolling) return;
						const scrollBottom = ref.scrollHeight - (ref.clientHeight + ref.scrollTop);
						setShouldAutoScroll(scrollBottom < threshold);
					},
					touchstart: () => {
						setShouldAutoScroll(false);
					},
					mousedown: () => {
						setShouldAutoScroll(false);
					},
					mouseup: () => {
						setShouldAutoScroll(true);
					},
					touchend: () => {
						setShouldAutoScroll(true);
					},
					touchcancel: () => {
						setShouldAutoScroll(true);
					}
				},
				{ passive: true }
			);
		});
	};

	return [
		{ autoScroll, shouldAutoScroll },
		{ scrollToBottom, setShouldAutoScroll }
	] as const;
}
