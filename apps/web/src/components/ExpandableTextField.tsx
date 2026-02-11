import type { PolymorphicProps } from '@kobalte/core';

import * as TextFieldPrimitive from '@kobalte/core/text-field';
import { createEventListenerMap } from '@solid-primitives/event-listener';
import { type JSXElement, splitProps, type ValidComponent } from 'solid-js';

import { cn } from '~/utils/tailwind';

import { TextField, TextFieldTextArea } from './ui/text-field';

type TextFieldTextAreaProps<T extends ValidComponent = 'textarea'> =
	TextFieldPrimitive.TextFieldTextAreaProps<T> & { class?: string | undefined };

export function ExpandableTextField<T extends ValidComponent = 'textarea'>(
	props: PolymorphicProps<T, TextFieldTextAreaProps<T>>
): JSXElement {
	let ref!: HTMLTextAreaElement;
	const [local, others] = splitProps(props as TextFieldTextAreaProps, ['class', 'ref']);
	createEventListenerMap(() => ref, {
		input: () => {
			const lineHeight = Number(getComputedStyle(ref).lineHeight.replace('px', ''));
			const paddingTop = Number(getComputedStyle(ref).paddingTop.replace('px', ''));
			const paddingBottom = Number(getComputedStyle(ref).paddingBottom.replace('px', ''));
			adjustHeight(ref, 20 * lineHeight + paddingTop + paddingBottom);
		},
		paste: () => {
			const lineHeight = Number(getComputedStyle(ref).lineHeight.replace('px', ''));
			const paddingTop = Number(getComputedStyle(ref).paddingTop.replace('px', ''));
			const paddingBottom = Number(getComputedStyle(ref).paddingBottom.replace('px', ''));
			adjustHeight(ref, 20 * lineHeight + paddingTop + paddingBottom);
		}
	});

	function adjustHeight(el: HTMLElement, maxHeight?: number) {
		const prevAlignment = el.style.alignSelf;
		const prevOverflow = el.style.overflow;

		const isFirefox = 'MozAppearance' in el.style;
		if (!isFirefox) {
			el.style.overflow = 'hidden';
		}

		el.style.alignSelf = 'start';
		el.style.height = 'auto';

		let newHeight = el.scrollHeight + (el.offsetHeight - el.clientHeight);
		if (maxHeight) {
			newHeight = Math.min(newHeight, maxHeight);
		}
		el.style.height = `${newHeight}px`;
		el.style.overflow = prevOverflow;
		el.style.alignSelf = prevAlignment;
	}

	return (
		<TextField>
			<TextFieldTextArea
				class={cn('resize-none min-h-0', local.class)}
				ref={(el) => {
					ref = el;
					if ('ref' in local) local.ref = el;
				}}
				{...others}
			/>
		</TextField>
	);
}

export default ExpandableTextField;
