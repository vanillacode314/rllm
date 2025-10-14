import { Repeat } from '@solid-primitives/range';
import rehypeReact from 'rehype-react';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createSignal, Index, type JSX, Match, Show, splitProps, Suspense, Switch } from 'solid-js';
import { Fragment, jsx, jsxs } from 'solid-js/h/jsx-runtime';
import { unified } from 'unified';

import { rehypePlugins, remarkPlugins } from '~/utils/markdown';
import { randomFloat } from '~/utils/math';
import { createLatestAsync } from '~/utils/signals';
import { cn } from '~/utils/tailwind';
import { markdownWorkerPool } from '~/workers/markdown';

import CopyButton from './CopyButton';
import { Button } from './ui/button';

const processor = unified()
	.use(remarkParse)
	.use(remarkPlugins)
	.use(remarkRehype)
	.use(rehypePlugins)
	.use(rehypeReact, {
		Fragment,
		jsx,
		jsxs,
		elementAttributeNameCase: 'html',
		stylePropertyNameCase: 'css',
		components: {
			pre: (props: any) => {
				const [local, others] = splitProps(props, ['class', 'ref']);
				const [text, setText] = createSignal<string>('');
				const [expanded, setExpanded] = createSignal(false);
				const [canExpand, setCanExpand] = createSignal(false);

				return (
					<div class="relative isolate">
						<div class="absolute top-0 right-0 m-2 z-10 flex items-center gap-2">
							<CopyButton value={text()}>
								{(status) => (
									<Button
										as="div"
										class={cn(
											'size-8 transition backdrop-blur-xs',
											status() === 'idle' ?
												'bg-secondary/50 hover:bg-secondary text-secondary-foreground'
											:	'',
											status() === 'success' ?
												'bg-success hover:bg-success/90 text-success-foreground'
											:	'',
											status() === 'error' ? 'bg-error hover:bg-error/90 text-error-foreground' : ''
										)}
										size="icon"
										variant="secondary"
									>
										<Switch>
											<Match when={status() === 'idle'}>
												<div class="icon-[heroicons--clipboard-document]" />
											</Match>
											<Match when={status() === 'success'}>
												<div class="icon-[heroicons--check]" />
											</Match>
											<Match when={status() === 'error'}>
												<div class="icon-[heroicons--x-mark]" />
											</Match>
										</Switch>
									</Button>
								)}
							</CopyButton>
							<Show when={canExpand()}>
								<Button
									class="size-8 transition backdrop-blur-xs bg-secondary/50 hover:bg-secondary text-secondary-foreground"
									onClick={() => setExpanded(!expanded())}
									size="icon"
									variant="secondary"
								>
									<span
										class={cn(
											'icon-[heroicons--chevron-down] transition-transform',
											expanded() ? 'rotate-180' : ''
										)}
									/>
									<span class="sr-only">{expanded() ? 'Collapse' : 'Expand'}</span>
								</Button>
							</Show>
						</div>
						<pre
							class={cn(
								local.class,
								'border border-secondary relative overflow-auto bg-neutral-950 mt-0',
								expanded() ? 'max-h-none' : 'max-h-72'
							)}
							ref={(el) =>
								setTimeout(() => {
									setText(el.textContent);
									setCanExpand(el.scrollHeight > el.clientHeight);
								})
							}
							{...others}
						/>
					</div>
				);
			},
			table: (props: any) => {
				return (
					<div class="overflow-x-auto">
						<table {...props} />
					</div>
				);
			}
		}
	});

type TProps = JSX.HTMLAttributes<HTMLDivElement> & {
	content: string;
	contentId: string;
	inProgress?: boolean;
	queryKey?: string[];
	worker?: boolean;
};
function LineSkeleton() {
	const width = randomFloat({ min: 0.5, max: 1 });
	return (
		<div
			class="h-[1em] rounded-full bg-primary/10 animate-pulse"
			style={{ width: `${width * 100}%` }}
		></div>
	);
}

function Markdown(props: TProps) {
	const [local, others] = splitProps(props, [
		'content',
		'contentId',
		'queryKey',
		'worker',
		'class',
		'inProgress'
	]);

	const update = async (content: string) => {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		if (!local.worker) {
			const file = await processor.process(content);
			return file.result;
		}
		const worker = await markdownWorkerPool.get();
		let tree;
		try {
			tree = await worker.parse(content);
		} finally {
			markdownWorkerPool.release(worker);
		}
		return processor.stringify(tree, content);
	};

	const [data, isPending] = createLatestAsync(() => local.content, update);

	return (
		<Suspense fallback={<MarkdownSkeleton content={local.content} />}>
			<div
				class={cn(
					'transition-opacity',
					!local.inProgress && isPending() && 'opacity-50',
					local.class
				)}
				{...others}
			>
				{data()}
			</div>
		</Suspense>
	);
}

function MarkdownSkeleton(props: { content: string }) {
	const paragraphs = () => props.content.split('\n\n');
	return (
		<div class="flex flex-col gap-4">
			<Index each={paragraphs()}>
				{(paragraph) => {
					const numberOfLines = () => paragraph().match(/\n/g)?.length ?? 1;
					return (
						<div class="flex flex-col gap-1">
							<Repeat times={numberOfLines()}>
								<LineSkeleton />
							</Repeat>
						</div>
					);
				}}
			</Index>
		</div>
	);
}

export default Markdown;
