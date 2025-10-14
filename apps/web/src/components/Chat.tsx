import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createShortcut } from '@solid-primitives/keyboard';
import { createWritableMemo } from '@solid-primitives/memo';
import { createElementSize } from '@solid-primitives/resize-observer';
import { makeTimer } from '@solid-primitives/timer';
import { debounce } from '@tanstack/solid-pacer';
import { useQuery } from '@tanstack/solid-query';
import {
	createMemo,
	createRenderEffect,
	createSignal,
	createUniqueId,
	Index,
	type JSX,
	type JSXElement,
	Match,
	Show,
	splitProps,
	Suspense,
	Switch
} from 'solid-js';
import { toast } from 'solid-sonner';

import type { TChat, TLLMMessageChunk, TMessage, TUserMessageChunk } from '~/types/chat';

import { queries } from '~/queries';
import { cn } from '~/utils/tailwind';
import { shikiWorkerPool } from '~/workers/shiki';

import Markdown from './Markdown';
import { Button } from './ui/button';
import { Callout, CalloutContent, CalloutTitle } from './ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { TextField, TextFieldTextArea } from './ui/text-field';

const AUTO_SCROLL_THRESHOLD = 50;

type Props = JSX.HTMLAttributes<HTMLDivElement> & {
	chat: TChat;
	class?: string | undefined;
	onDelete: (path: number[], chunkIndex?: number) => void;
	onEdit: (path: number[], chunkIndex: number, chunk: TUserMessageChunk) => void;
	onRegenerate: (path: number[]) => void;
	onTraversal: (path: number[], direction: -1 | 1) => void;
	path: number[];
	scrollingStatus: 'auto' | 'manual' | 'none';
	setScrollingStatus: (value: 'auto' | 'manual' | 'none') => void;
};
export function Chat(props: Props): JSXElement {
	const [local, others] = splitProps(props, [
		'class',
		'ref',
		'setScrollingStatus',
		'scrollingStatus',
		'chat',
		'onDelete',
		'onEdit',
		'onRegenerate',
		'onTraversal',
		'path'
	]);
	const [ref, setRef] = createSignal<HTMLDivElement>();
	const [initialized, setInitialized] = createSignal(false);
	makeTimer(
		() => {
			updateManualScrolling();
			setInitialized(true);
		},
		100,
		setTimeout
	);
	let scrollContainerRef!: HTMLDivElement;

	const refSize = createElementSize(ref);
	const scrollContainerRefSize = createElementSize(() => scrollContainerRef);

	function updateManualScrolling() {
		if (local.scrollingStatus === 'auto') return;
		const $ref = ref();
		if (!$ref) return;
		local.setScrollingStatus(
			Math.abs($ref.scrollHeight - $ref.scrollTop - $ref.clientHeight) > AUTO_SCROLL_THRESHOLD ?
				'manual'
			:	'none'
		);
	}

	createEventListenerMap(
		() => ref()!,
		{
			scroll: () => updateManualScrolling(),
			touchstart: () => {
				const $ref = ref();
				if (!$ref) return;
				props.setScrollingStatus(
					$ref.scrollHeight - $ref.clientHeight > AUTO_SCROLL_THRESHOLD ? 'manual' : 'auto'
				);
				updateManualScrolling();
			},
			touchcancel: () => updateManualScrolling(),
			touchend: () => updateManualScrolling()
		},
		{ passive: true }
	);

	const scrollToBottom = debounce(
		(force: boolean = false) => {
			if (!force && local.scrollingStatus === 'manual') return;
			const $ref = ref();
			if (!$ref) return;
			local.setScrollingStatus('auto');
			$ref.addEventListener(
				'scrollend',
				() => local.scrollingStatus === 'auto' && local.setScrollingStatus('none'),
				{
					once: true,
					passive: true
				}
			);
			$ref.scrollTo({
				top: $ref.scrollHeight,
				behavior: 'smooth'
			});
		},
		{ wait: 16 }
	);

	createRenderEffect(() => {
		if (!initialized()) return;
		JSON.stringify(nodes());
		setTimeout(() => scrollToBottom(), 10);
	});

	const nodes = createMemo(() =>
		props.chat.messages
			.iter(props.path)
			.map(({ node: nodeOption, path }) => {
				const node = nodeOption.unwrap();
				const siblings = node.parent.unwrap().children;
				const pathIndex = path.at(-1)!;
				return {
					pathIndex,
					node,
					numberOfSiblings: siblings.length - 1
				};
			})
			.toArray()
	);

	return (
		<div class="relative overflow-hidden grid">
			<div
				class={cn('overflow-auto', props.class)}
				ref={(el) => {
					setRef(el);
					if (!('ref' in local)) return;
					if (typeof local.ref === 'function') {
						local.ref(el);
						return;
					}
					local.ref = el;
				}}
				{...others}
			>
				<div class="flex flex-col gap-10" ref={scrollContainerRef}>
					<Index each={nodes()}>
						{(data, index) => {
							const message = () => data().node.value.unwrap();
							const currentPath = createMemo(() => props.path.slice(0, index + 1));

							return (
								<Show
									fallback={
										<UserChat
											canDelete={
												message().chunks.length > 1 &&
												(index !== 0 || data().numberOfSiblings > 0 || props.path[0] !== 0)
											}
											index={data().pathIndex}
											message={message() as TMessage & { type: 'user' }}
											numberOfSiblings={data().numberOfSiblings}
											onDelete={props.onDelete.bind(null, currentPath())}
											onEdit={props.onEdit.bind(null, currentPath())}
											onTraversal={props.onTraversal.bind(null, currentPath())}
										/>
									}
									when={message().type === 'llm'}
								>
									<LLMChat
										index={data().pathIndex}
										message={message() as TMessage & { type: 'llm' }}
										numberOfSiblings={data().numberOfSiblings}
										onDelete={props.onDelete.bind(null, currentPath())}
										onRegenerate={props.onRegenerate.bind(null, currentPath())}
										onTraversal={props.onTraversal.bind(null, currentPath())}
									/>
								</Show>
							);
						}}
					</Index>
				</div>
			</div>
			<Show
				when={
					props.scrollingStatus === 'manual' &&
					(refSize.height ?? 0) < (scrollContainerRefSize.height ?? 0) - AUTO_SCROLL_THRESHOLD
				}
			>
				<Button
					class="absolute bottom-(--bottom-arrow,0) left-1/2 rounded-full size-8 text-secondary-foreground/50 hover:text-secondary-foreground bg-secondary/50 hover:bg-secondary border border-secondary-foreground/25 motion-preset-fade motion-duration-300 transition-colors backdrop-blur-xs will-change-transform"
					onClick={() => {
						props.setScrollingStatus('manual');
						scrollToBottom(true);
					}}
					size="icon"
					style={{ transform: 'translate3d(-50%, var(--translate-y-arrow, 0px), 0)' }}
					variant="secondary"
				>
					<span class="icon-[heroicons--arrow-down] text-xs" />
				</Button>
			</Show>
		</div>
	);
}

function LLMChat(props: {
	index: number;
	message: TMessage & { type: 'llm' };
	numberOfSiblings: number;
	onDelete?: () => void;
	onRegenerate: () => void;
	onTraversal: (direction: -1 | 1) => void;
}) {
	const hasNext = () => props.index < props.numberOfSiblings;
	const hasPrev = () => props.index > 0;
	const [open, setOpen] = createSignal(true);

	return (
		<Card class="bg-transparent border-none shadow-none">
			<Collapsible onOpenChange={setOpen} open={open()}>
				<CardHeader class="p-2 grid gap-4 pb-2 grid-cols-[1fr_auto] items-center overflow-hidden">
					<CardTitle class="text-base flex items-center gap-2 overflow-hidden mb-0">
						<Show when={!props.message.finished}>
							<span class="icon-[svg-spinners--180-ring-with-bg] shrink-0" />
						</Show>
						<Show when={props.message.error}>
							<span class="icon-[heroicons--exclamation-circle] text-destructive shrink-0" />
						</Show>
						<span class="whitespace-nowrap overflow-x-auto text-sm">
							@{props.message.model}{' '}
							<span class="font-normal text-muted-foreground">({props.message.provider})</span>
						</span>
					</CardTitle>
					<div class="flex gap-2 justify-end items-center">
						<CollapsibleTrigger
							as={Button<'button'>}
							class="size-6"
							size="icon"
							type="button"
							variant="ghost"
						>
							<Show when={open()}>
								<span class="icon-[heroicons--chevron-up]" />
							</Show>
							<Show when={!open()}>
								<span class="icon-[heroicons--chevron-down]" />
							</Show>
							<span class="sr-only">Toggle</span>
						</CollapsibleTrigger>
						<Button
							class="size-6"
							onClick={() => {
								props.onRegenerate();
							}}
							size="icon"
							type="button"
							variant="ghost"
						>
							<span class="sr-only">Regenerate</span>
							<span class="icon-[heroicons--arrow-path]" />
						</Button>
						<Show when={props.onDelete}>
							<Button
								class="size-6"
								onClick={() => {
									const yes = confirm('Are you sure?');
									if (!yes) return;
									props.onDelete!();
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Delete</span>
								<span class="icon-[heroicons--trash]" />
							</Button>
						</Show>
						<Show when={hasPrev() || hasNext()}>
							<Button
								class="size-6"
								disabled={!hasPrev()}
								onClick={() => {
									props.onTraversal(-1);
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Previous</span>
								<span class="icon-[heroicons--arrow-left]" />
							</Button>
							<span class="text-xs font-mono text-muted-foreground">
								{props.index + 1}/{props.numberOfSiblings + 1}
							</span>
							<Button
								class="size-6"
								disabled={!hasNext()}
								onClick={() => {
									props.onTraversal(1);
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Next</span>
								<span class="icon-[heroicons--arrow-right]" />
							</Button>
						</Show>
					</div>
				</CardHeader>
				<CollapsibleContent>
					<CardContent class="space-y-4 p-2 overflow-x-auto">
						<Index each={props.message.chunks}>
							{(chunk) => (
								<Switch>
									<Match when={chunk().type === 'reasoning'}>
										<LLMReasoningChunk
											chunk={chunk() as TLLMMessageChunk & { type: 'reasoning' }}
											inProgress={!props.message.finished}
										/>
									</Match>
									<Match when={chunk().type === 'tool_call'}>
										<LLMToolCallChunk chunk={chunk() as TLLMMessageChunk & { type: 'tool_call' }} />
									</Match>
									<Match when={true}>
										<LLMTextChunk
											chunk={chunk() as TLLMMessageChunk & { type: 'text' }}
											inProgress={!props.message.finished}
										/>
									</Match>
								</Switch>
							)}
						</Index>
						<Show when={props.message.error}>
							<Callout variant="error">
								<CalloutTitle>Error</CalloutTitle>
								<CalloutContent class="wrap-break-word whitespace-pre-wrap">
									{props.message.error}
								</CalloutContent>
							</Callout>
						</Show>
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}

function LLMReasoningChunk(props: {
	chunk: TLLMMessageChunk & { type: 'reasoning' };
	inProgress: boolean;
}) {
	const [open, setOpen] = createWritableMemo(() => props.chunk.finished);

	return (
		<Collapsible class="space-y-1.5" onOpenChange={(value) => setOpen(!value)} open={!open()}>
			<CollapsibleTrigger class="text-sm opacity-90 flex w-full items-center gap-2">
				<span>Reasoning</span>
				<Show
					fallback={<span class="icon-[heroicons--chevron-up-down]" />}
					when={!props.chunk.finished}
				>
					<span class="icon-[svg-spinners--180-ring-with-bg]" />
				</Show>
			</CollapsibleTrigger>
			<CollapsibleContent class="bg-muted p-4 border-l-4 border-l-muted-foreground rounded-r-lg">
				<Markdown
					class="max-w-none prose dark:prose-invert text-muted-foreground"
					content={props.chunk.content}
					contentId={props.chunk.id}
					inProgress={props.inProgress}
				/>
			</CollapsibleContent>
		</Collapsible>
	);
}

function LLMTextChunk(props: { chunk: TLLMMessageChunk & { type: 'text' }; inProgress: boolean }) {
	return (
		<Markdown
			class="max-w-none prose dark:prose-invert"
			content={props.chunk.content}
			contentId={props.chunk.id}
			inProgress={props.inProgress}
		/>
	);
}

function LLMToolCallChunk(props: { chunk: TLLMMessageChunk & { type: 'tool_call' } }) {
	const finished = () => props.chunk.finished;
	const requestHtml = useQuery(() => ({
		queryKey: ['html', props.chunk.id],
		staleTime: Infinity,
		queryFn: async () => {
			const worker = await shikiWorkerPool.get();
			return worker
				.codeToHtml(JSON.stringify(JSON.parse(props.chunk.tool.arguments), null, 2), {
					lang: 'json',
					themes: {
						dark: 'vitesse-dark',
						light: 'vitesse-light'
					},
					colorReplacements: {
						'#1d2021': 'var(--color-background)'
					}
				})
				.finally(() => shikiWorkerPool.release(worker));
		}
	}));

	return (
		<Collapsible class="space-y-1.5" defaultOpen={false}>
			<CollapsibleTrigger class="text-sm opacity-90 flex w-full items-center gap-2">
				<span>Tool Call ({props.chunk.tool.name})</span>
				<Show fallback={<span class="icon-[heroicons--chevron-up-down]" />} when={!finished()}>
					<span class="icon-[svg-spinners--180-ring-with-bg]" />
				</Show>
			</CollapsibleTrigger>
			<CollapsibleContent class="space-y-2">
				<article class="space-y-0.5">
					<h3 class="text-muted-foreground text-sm">Request:</h3>
					<div
						class="rounded border p-3 text-xs overflow-auto"
						innerHTML={requestHtml.isSuccess ? requestHtml.data : ''}
					/>
				</article>
				<article class="space-y-0.5">
					<h3 class="text-muted-foreground text-sm">Response:</h3>
					<div
						class="rounded border p-3 text-xs max-h-96 overflow-auto whitespace-pre-wrap"
						innerHTML={props.chunk.content}
					/>
				</article>
			</CollapsibleContent>
		</Collapsible>
	);
}

function UserChat(props: {
	canDelete: boolean;
	index: number;
	message: TMessage & { type: 'user' };
	numberOfSiblings: number;
	onDelete: (chunkIndex?: number) => void;
	onEdit: (chunkIndex: number, chunk: TUserMessageChunk) => void;
	onTraversal: (direction: -1 | 1) => void;
}) {
	const hasNext = () => props.index < props.numberOfSiblings;
	const hasPrev = () => props.index > 0;
	const displayName = useQuery(() => queries.userMetadata.byId('user-display-name'));
	const filteredChunks = createMemo(() => props.message.chunks.filter((chunk) => !chunk.hidden));
	const [open, setOpen] = createSignal(true);

	return (
		<>
			<Card class="border-primary border">
				<Collapsible onOpenChange={setOpen} open={open()}>
					<div class="flex empty:pb-0 p-4 gap-2 justify-end items-center relative">
						<div class="absolute left-4 text-sm font-semibold top-4">
							<Suspense>@{displayName.isSuccess ? displayName.data : 'user'}</Suspense>
						</div>
						<CollapsibleTrigger
							as={Button<'button'>}
							class="size-6"
							size="icon"
							type="button"
							variant="ghost"
						>
							<Show when={open()}>
								<span class="icon-[heroicons--chevron-up]" />
							</Show>
							<Show when={!open()}>
								<span class="icon-[heroicons--chevron-down]" />
							</Show>
							<span class="sr-only">Toggle</span>
						</CollapsibleTrigger>
						<Show when={props.canDelete}>
							<Button
								class="size-6"
								onClick={() => {
									const yes = confirm('Are you sure?');
									if (!yes) return;
									props.onDelete();
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Delete</span>
								<span class="icon-[heroicons--trash]" />
							</Button>
						</Show>
						<Show when={hasPrev() || hasNext()}>
							<Button
								class="size-6"
								disabled={!hasPrev()}
								onClick={() => {
									props.onTraversal(-1);
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Previous</span>
								<span class="icon-[heroicons--arrow-left]" />
							</Button>
							<span class="text-xs font-mono text-muted-foreground">
								{props.index + 1}/{props.numberOfSiblings + 1}
							</span>
							<Button
								class="size-6"
								disabled={!hasNext()}
								onClick={() => {
									props.onTraversal(1);
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Next</span>
								<span class="icon-[heroicons--arrow-right]" />
							</Button>
						</Show>
					</div>
					<CollapsibleContent>
						<CardContent class="p-4 pt-0 flex flex-col gap-4">
							<Index each={filteredChunks()}>
								{(chunk, index) => (
									<Switch>
										<Match when={chunk().type === 'text'}>
											<UserTextChunk
												chunk={chunk() as TUserMessageChunk & { type: 'text' }}
												onDelete={props.onDelete.bind(null, index)}
												onEdit={props.onEdit.bind(null, index)}
											/>
										</Match>
										<Match when={chunk().type === 'image_url'}>
											<UserImageChunk
												chunk={chunk() as TUserMessageChunk & { type: 'image' }}
												onDelete={props.onDelete.bind(null, index)}
											/>
										</Match>
									</Switch>
								)}
							</Index>
						</CardContent>
					</CollapsibleContent>
				</Collapsible>
			</Card>
		</>
	);
}

function UserImageChunk(props: {
	chunk: TUserMessageChunk & { type: 'image_url' };
	onDelete: () => void;
}) {
	return (
		<div class="relative isolate max-w-36 rounded-lg overflow-hidden first:mt-4">
			<img alt={props.chunk.filename} class="w-full h-auto" src={props.chunk.url} />
			<Button
				class="absolute top-2 right-2 size-6"
				onClick={() => {
					const yes = confirm('Are you sure?');
					if (!yes) return;
					props.onDelete();
				}}
				size="icon"
				type="button"
				variant="destructive"
			>
				<span class="sr-only">Delete</span>
				<span class="icon-[heroicons--trash]" />
			</Button>
			<span class="z-10 absolute bottom-0 p-2 text-xs text-muted-foreground bg-linear-to-t from-background from-30% to-transparent break-all">
				{props.chunk.filename}
			</span>
		</div>
	);
}

function UserTextChunk(props: {
	chunk: TUserMessageChunk & { type: 'text' };
	onDelete: () => void;
	onEdit: (chunk: TUserMessageChunk) => void;
}) {
	const [content, setContent] = createSignal(props.chunk.content);
	const [editing, setEditing] = createSignal(false);
	const id = createUniqueId(); // [1]

	createShortcut(
		['Control', 'Enter'],
		(event) => {
			if (!event) return;
			if (document.activeElement?.id === `prompt:${id}`) {
				event.preventDefault();
				const input = document.activeElement as HTMLTextAreaElement;
				input.blur();
				setEditing(false);
				props.onEdit({
					...props.chunk,
					content: content()
				});
			}
		},
		{ preventDefault: false }
	);

	return (
		<div class="flex flex-col gap-4">
			<div class="flex gap-1 self-end">
				<Show
					fallback={
						<>
							<Button
								class="size-6"
								onClick={() => {
									setEditing(false);
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Cancel</span>
								<span class="icon-[heroicons--x-mark]" />
							</Button>
							<Button
								class="size-6"
								onClick={() => {
									setEditing(false);
									props.onEdit({
										...props.chunk,
										content: content()
									});
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<span class="sr-only">Save</span>
								<span class="icon-[heroicons--check]" />
							</Button>
						</>
					}
					when={!editing()}
				>
					<Button
						class="size-6"
						onClick={() => {
							navigator.clipboard.writeText(props.chunk.content);
							toast.success('Copied to clipboard');
						}}
						size="icon"
						type="button"
						variant="ghost"
					>
						<span class="sr-only">Copy</span>
						<span class="icon-[heroicons--clipboard-document]" />
					</Button>
					<Button
						class="size-6"
						onClick={() => {
							setEditing(true);
							queueMicrotask(() => {
								const input = document.getElementById(`prompt:${id}`) as HTMLTextAreaElement;
								input.focus();
							});
						}}
						size="icon"
						type="button"
						variant="ghost"
					>
						<span class="sr-only">Edit</span>
						<span class="icon-[heroicons--pencil]" />
					</Button>
					<Button
						class="size-6"
						onClick={() => {
							const yes = confirm('Are you sure?');
							if (!yes) return;
							props.onDelete();
						}}
						size="icon"
						type="button"
						variant="ghost"
					>
						<span class="sr-only">Delete</span>
						<span class="icon-[heroicons--trash]" />
					</Button>
				</Show>
			</div>
			<Show
				fallback={
					<TextField>
						<TextFieldTextArea
							class="min-h-32 text-sm"
							id={`prompt:${id}`}
							onChange={(e) => setContent(e.target.value)}
							value={content()}
						/>
					</TextField>
				}
				when={!editing()}
			>
				<Markdown
					class="max-w-none prose dark:prose-invert"
					content={props.chunk.content}
					contentId={props.chunk.id}
				/>
			</Show>
		</div>
	);
}

export default Chat;
