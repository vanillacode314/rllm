import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { JSX, ValidComponent } from 'solid-js';

import * as AccordionPrimitive from '@kobalte/core/accordion';
import { splitProps } from 'solid-js';

import { cn } from '~/utils/tailwind';

const Accordion = AccordionPrimitive.Root;

type AccordionItemProps<T extends ValidComponent = 'div'> =
	AccordionPrimitive.AccordionItemProps<T> & {
		class?: string | undefined;
	};

const AccordionItem = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, AccordionItemProps<T>>
) => {
	const [local, others] = splitProps(props as AccordionItemProps, ['class']);
	return <AccordionPrimitive.Item class={cn('border-b', local.class)} {...others} />;
};

type AccordionTriggerProps<T extends ValidComponent = 'button'> =
	AccordionPrimitive.AccordionTriggerProps<T> & {
		children?: JSX.Element;
		class?: string | undefined;
	};

const AccordionTrigger = <T extends ValidComponent = 'button'>(
	props: PolymorphicProps<T, AccordionTriggerProps<T>>
) => {
	const [local, others] = splitProps(props as AccordionTriggerProps, ['class', 'children']);
	return (
		<AccordionPrimitive.Header class="flex">
			<AccordionPrimitive.Trigger
				class={cn(
					'flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-expanded]>svg]:rotate-180',
					local.class
				)}
				{...others}
			>
				{local.children}
				<svg
					class="size-4 shrink-0 transition-transform duration-200"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M6 9l6 6l6 -6" />
				</svg>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
};

type AccordionContentProps<T extends ValidComponent = 'div'> =
	AccordionPrimitive.AccordionContentProps<T> & {
		children?: JSX.Element;
		class?: string | undefined;
	};

const AccordionContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, AccordionContentProps<T>>
) => {
	const [local, others] = splitProps(props as AccordionContentProps, ['class', 'children']);
	return (
		<AccordionPrimitive.Content
			class={cn(
				'animate-accordion-up overflow-hidden text-sm transition-all data-[expanded]:animate-accordion-down',
				local.class
			)}
			{...others}
		>
			<div class="pb-4 pt-0">{local.children}</div>
		</AccordionPrimitive.Content>
	);
};

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
