import { For, Show } from 'solid-js';

import { cn } from '~/utils/tailwind';

export function ValidationErrors(props: {
	class?: string | undefined;
	errors: string[] | undefined;
}) {
	return (
		<Show when={props.errors && props.errors.length > 0}>
			<div class={cn('flex flex-col text-destructive text-sm', props.class)}>
				<For each={props.errors}>{(error) => <span>{error}</span>}</For>
			</div>
		</Show>
	);
}

export default ValidationErrors;
