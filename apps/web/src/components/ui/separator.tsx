import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';

import * as SeparatorPrimitive from '@kobalte/core/separator';
import { splitProps } from 'solid-js';

import { cn } from '~/utils/tailwind';

type SeparatorRootProps<T extends ValidComponent = 'hr'> =
	SeparatorPrimitive.SeparatorRootProps<T> & { class?: string | undefined };

const Separator = <T extends ValidComponent = 'hr'>(
	props: PolymorphicProps<T, SeparatorRootProps<T>>
) => {
	const [local, others] = splitProps(props as SeparatorRootProps, ['class', 'orientation']);
	return (
		<SeparatorPrimitive.Root
			class={cn(
				'shrink-0 bg-border',
				local.orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
				local.class
			)}
			orientation={local.orientation ?? 'horizontal'}
			{...others}
		/>
	);
};

export { Separator };
