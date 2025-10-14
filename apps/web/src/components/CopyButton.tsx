import { type Accessor, createSignal, type JSX, type JSXElement, Show, splitProps } from 'solid-js';
import { toast } from 'solid-sonner';
import { AsyncResult } from 'ts-result-option';

type Props = Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> & {
	children?: (status: Accessor<'error' | 'idle' | 'success'>) => JSXElement;
	value: string;
};
function CopyButton(props: Props) {
	const [local, others] = splitProps(props, ['children', 'value']);
	const [status, setStatus] = createSignal<'error' | 'idle' | 'success'>('idle');

	return (
		<button
			class="copy-button"
			disabled={status() !== 'idle'}
			onClick={async () => {
				const copy = AsyncResult.wrap(
					(data: string) => navigator.clipboard.writeText(data),
					(e) => new Error('Failed to copy', { cause: e })
				);
				await copy(local.value)
					.inspectErr(() => {
						setStatus('error');
						setTimeout(() => setStatus('idle'), 2000);
						toast.error('Failed to copy to clipboard');
					})
					.inspect(() => {
						setStatus('success');
						setTimeout(() => setStatus('idle'), 2000);
						toast.success('Copied to clipboard');
					})
					.unwrap();
			}}
			{...others}
		>
			<Show
				fallback={
					<div class="flex items-center gap-2">
						<span class="icon-[heroicons--clipboard-document]" />
						<span>Copy</span>
					</div>
				}
				when={local.children}
			>
				{local.children?.(status)}
			</Show>
		</button>
	);
}

export default CopyButton;
