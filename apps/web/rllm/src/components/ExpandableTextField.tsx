import type { PolymorphicProps } from '@kobalte/core';
import * as TextFieldPrimitive from '@kobalte/core/text-field';
import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createEffect, type JSXElement, splitProps, untrack, type ValidComponent } from 'solid-js';
import { TextField, TextFieldTextArea } from 'ui/text-field';
import { cn } from 'ui/utils/tailwind';

import { combineRefs } from '~/utils/ref';

const MAX_LINES = 20;

type TextFieldTextAreaProps<T extends ValidComponent = 'textarea'> =
  TextFieldPrimitive.TextFieldTextAreaProps<T> & {
    ref?: (el: HTMLTextAreaElement) => void;
    class?: string | undefined;
    onPaste: (event: ClipboardEvent) => void;
  };

export function ExpandableTextField<T extends ValidComponent = 'textarea'>(
  props: PolymorphicProps<T, TextFieldTextAreaProps<T>>
): JSXElement {
  let ref!: HTMLTextAreaElement;
  const [local, others] = splitProps(props as TextFieldTextAreaProps, ['class', 'ref']);

  let composing = false;

  createEffect(() => {
    if (!('value' in others)) return;
    void others.value;
    if (composing) return;
    untrack(adjustHeight);
  });

  createEventListenerMap(() => ref, {
    input: () => {
      if (composing) return;
      adjustHeight();
    },
    compositionstart: () => {
      composing = true;
    },
    compositionend: () => {
      composing = false;
      adjustHeight();
    }
  });

  function adjustHeight() {
    if (!ref?.isConnected) return;

    const style = getComputedStyle(ref);
    const lineHeight = Number.parseFloat(style.lineHeight) || 0;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const maxHeight = MAX_LINES * lineHeight + paddingTop + paddingBottom;

    const prevAlignSelf = ref.style.alignSelf;
    const prevOverflow = ref.style.overflow;
    const { selectionStart, selectionEnd } = ref;
    const isFocused = document.activeElement === ref;

    const isFirefox = 'MozAppearance' in ref.style;
    ref.style.alignSelf = 'start';
    if (!isFirefox) ref.style.overflow = 'hidden';
    ref.style.height = 'auto';

    const borderBoxDelta = ref.offsetHeight - ref.clientHeight;
    let newHeight = ref.scrollHeight + borderBoxDelta;
    if (maxHeight > 0) newHeight = Math.min(newHeight, maxHeight);

    ref.style.height = `${newHeight}px`;
    ref.style.overflow = prevOverflow;
    ref.style.alignSelf = prevAlignSelf;

    if (isFocused && selectionStart != null && selectionEnd != null) {
      try {
        ref.setSelectionRange(selectionStart, selectionEnd);
      } catch {}
    }
  }

  return (
    <TextField>
      <TextFieldTextArea
        class={cn('resize-none min-h-0', local.class)}
        ref={combineRefs(local.ref, (el) => (ref = el))}
        {...others}
      />
    </TextField>
  );
}

export default ExpandableTextField;
