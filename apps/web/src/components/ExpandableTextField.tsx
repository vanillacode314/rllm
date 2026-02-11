import type { PolymorphicProps } from '@kobalte/core';

import * as TextFieldPrimitive from '@kobalte/core/text-field';
import { createEventListenerMap } from '@solid-primitives/event-listener';
import {
  createRenderEffect,
  type JSXElement,
  splitProps,
  untrack,
  type ValidComponent
} from 'solid-js';

import { cn } from '~/utils/tailwind';

import { TextField, TextFieldTextArea } from './ui/text-field';

type TextFieldTextAreaProps<T extends ValidComponent = 'textarea'> =
  TextFieldPrimitive.TextFieldTextAreaProps<T> & { class?: string | undefined };

export function ExpandableTextField<T extends ValidComponent = 'textarea'>(
  props: PolymorphicProps<T, TextFieldTextAreaProps<T>>
): JSXElement {
  let ref!: HTMLTextAreaElement;
  const [local, others] = splitProps(props as TextFieldTextAreaProps, ['class', 'ref']);

  createRenderEffect(() => {
    if (!('value' in others)) return;
    void others.value;
    untrack(adjustHeight);
  });
  createEventListenerMap(() => ref, {
    input: adjustHeight,
    paste: adjustHeight
  });

  function adjustHeight() {
    if (!ref) return;
    const lineHeight = Number(getComputedStyle(ref).lineHeight.replace('px', ''));
    const paddingTop = Number(getComputedStyle(ref).paddingTop.replace('px', ''));
    const paddingBottom = Number(getComputedStyle(ref).paddingBottom.replace('px', ''));
    const maxHeight = 20 * lineHeight + paddingTop + paddingBottom;
    const prevAlignment = ref.style.alignSelf;
    const prevOverflow = ref.style.overflow;

    const isFirefox = 'MozAppearance' in ref.style;
    if (!isFirefox) {
      ref.style.overflow = 'hidden';
    }

    ref.style.alignSelf = 'start';
    ref.style.height = 'auto';

    let newHeight = ref.scrollHeight + (ref.offsetHeight - ref.clientHeight);
    if (maxHeight) {
      newHeight = Math.min(newHeight, maxHeight);
    }
    ref.style.height = `${newHeight}px`;
    ref.style.overflow = prevOverflow;
    ref.style.alignSelf = prevAlignment;
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
