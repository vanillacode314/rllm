import type { PolymorphicProps } from '@kobalte/core'

import * as TextFieldPrimitive from '@kobalte/core/text-field'
import {
  createMemo,
  createSignal,
  type JSXElement,
  splitProps,
  type ValidComponent,
} from 'solid-js'

import { clamp } from '~/utils/number'
import { cn } from '~/utils/tailwind'

import { TextField, TextFieldTextArea } from './ui/text-field'

type Props<T extends ValidComponent = 'textarea'> = PolymorphicProps<
  T,
  TextFieldTextAreaProps<T>
>
type TextFieldTextAreaProps<T extends ValidComponent = 'textarea'> =
  TextFieldPrimitive.TextFieldTextAreaProps<T> & { class?: string | undefined }
export function ExpandableTextField<T extends ValidComponent = 'textarea'>(
  props: Props<T>,
): JSXElement {
  let ref!: HTMLTextAreaElement
  const [local, others] = splitProps(props, ['onInput', 'class'])
  const padding = `var(--spacing) * 4`
  const [value, setValue] = createSignal<string>('')
  const maxLines = createMemo(() =>
    clamp(Array.from(value().matchAll(/\n{1}/g)).length + 1, 1, 30),
  )
  const height = () =>
    `calc(var(--tw-leading, var(--text-sm--line-height)) * ${maxLines()}em 
            + ${padding} 
            + 4px`

  return (
    <TextField>
      <TextFieldTextArea
        class={cn('resize-none', local.class)}
        onInput={(event) => {
          setValue((event.target as HTMLInputElement).value)
          local.onInput?.(event)
        }}
        ref={ref}
        style={{
          'min-height': height(),
          'max-height': height(),
          height: height(),
        }}
        value={value()}
        {...others}
      />
    </TextField>
  )
}

export default ExpandableTextField
