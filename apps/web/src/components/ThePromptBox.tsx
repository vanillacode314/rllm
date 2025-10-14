import { useQuery } from '@tanstack/solid-query';
import { useNavigate } from '@tanstack/solid-router';
import { createEvent } from 'solid-events';
import { For, type JSX, Match, Show, splitProps, Switch } from 'solid-js';

import type { TAttachment } from '~/types/chat';

import { logger } from '~/db/client';
import { queries } from '~/queries';
import { getFile } from '~/utils/files';
import { cn } from '~/utils/tailwind';

import { ExpandableTextField } from './ExpandableTextField';
import { setChatSettingsDrawerOpen } from './TheChatSettingsDrawer';
import { setCommandPromptOpen } from './TheCommandPrompt';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from './ui/dropdown-menu';

const [onAttachment, emitAttachment] = createEvent<File>();
const [onRemoveAttachment, emitRemoveAttachment] = createEvent<string>();
const [onMessage, emitMessage] = createEvent<string>();
export { onAttachment, onMessage, onRemoveAttachment };

type Props = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onInput'> & {
	attachments: TAttachment[];
	chatId?: string;
	class?: string | undefined;
	inputRef?: ((el: HTMLTextAreaElement) => void) | HTMLTextAreaElement;
	isPending: boolean;
	onAbort: () => void;
	onInput: (value: string) => void;
	prompt: string;
};
export function PromptBox(props: Props) {
	const [local, others] = splitProps(props, [
		'class',
		'chatId',
		'inputRef',
		'isPending',
		'onAbort',
		'onInput',
		'prompt',
		'attachments'
	]);

	return (
		<div class={cn('[view-transition-name:prompt-box] flex flex-col', local.class)} {...others}>
			<form
				class="contents"
				id="message-form"
				onSubmit={(event) => {
					event.preventDefault();
					emitMessage(local.prompt);
				}}
				style={{
					'grid-template-columns': local.chatId ? 'auto auto 1fr auto' : 'auto 1fr auto'
				}}
			>
				<ExpandableTextField
					class="bg-transparent border-none p-4 pb-0 focus-visible:ring-0 focus-visible:ring-offset-0"
					id="prompt"
					name="prompt"
					onInput={(e) => local.onInput(e.currentTarget.value)}
					onPaste={(e) => {
						const data = e.clipboardData;
						for (let i = 0; i < data.items.length; i++) {
							const item = data.items[i];
							if (item.kind === 'file') {
								const file = item.getAsFile();
								if (!file) continue;
								emitAttachment(file);
							}
						}
					}}
					placeholder="Message"
					ref={local.inputRef}
					value={local.prompt}
				/>
				<Show when={local.attachments.length > 0}>
					<ul class="p-4 flex gap-4 pb-0 overflow-x-auto">
						<For each={local.attachments}>
							{(attachment) => (
								<li
									class="grid grid-cols-[auto_1fr_auto] gap-2 items-center bg-primary/20 p-2 rounded-lg max-w-48 relative before:absolute before:inset-0 before:bg-primary/20  before:origin-left before:scale-x-[var(--progress)] before:transition-transform overflow-hidden"
									style={{
										'--progress': attachment.progress
									}}
									title={attachment.description}
								>
									<span
										class={cn(
											attachment.progress < 1 ?
												'icon-[svg-spinners--180-ring-with-bg]'
											:	'icon-[heroicons--document]'
										)}
									/>
									<h4 class="text-xs font-semibold uppercase tracking-wider truncate">
										{attachment.description}
									</h4>
									<Button
										class="size-6"
										disabled={attachment.progress < 1}
										onClick={() => emitRemoveAttachment(attachment.id)}
										size="icon"
										type="button"
										variant="ghost"
									>
										<span class="icon-[heroicons--x-mark]" />
									</Button>
								</li>
							)}
						</For>
					</ul>
				</Show>
				<Toolbar chatId={local.chatId} isPending={local.isPending} onAbort={local.onAbort} />
			</form>
		</div>
	);
}

function Toolbar(props: { chatId?: string; isPending: boolean; onAbort: () => void }) {
	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const mcpClients = useQuery(() => queries.mcps.all()._ctx.clients(proxyUrl.data));
	const selectedModelId = useQuery(() => queries.userMetadata.byId('selected-model-id'));
	const modelName = () =>
		selectedModelId.isSuccess && selectedModelId.data ?
			selectedModelId.data.includes('/') ?
				selectedModelId.data.split('/')[1]
			:	selectedModelId.data
		:	'';

	const navigate = useNavigate();

	return (
		<div class="flex gap-2 flex-col p-4">
			<div class="flex gap-2">
				<Show when={props.chatId}>
					<Button
						class="shrink-0"
						disabled={props.isPending}
						onClick={async () => {
							const yes = confirm('Are you sure you want to delete this chat?');
							if (!yes) return;
							await navigate({ to: '/' });
							await logger.dispatch({
								user_intent: 'delete_chat',
								meta: {
									id: props.chatId!
								}
							});
						}}
						size="icon"
						type="button"
						variant="destructive"
					>
						<span class="icon-[heroicons--trash] text-xl" />
						<span class="sr-only">Delete chat</span>
					</Button>
				</Show>
				<Show when={mcpClients.data?.length ?? 0 > 0}>
					<div class="flex gap-4 items-center overflow-x-auto">
						<For each={mcpClients.data}>
							{(mcp) => (
								<button
									onClick={() => {
										if (mcp.status === 'connected') mcp.disconnect();
										else mcp.initSession();
									}}
									type="button"
								>
									<Badge
										class="flex gap-1 items-center"
										variant={mcp.status === 'connected' ? 'success' : 'outline'}
									>
										<Switch>
											<Match when={mcp.status === 'connecting'}>
												<span class="icon-[svg-spinners--180-ring-with-bg]" />
											</Match>
											<Match when={mcp.status === 'connected'}>
												<span class="icon-[heroicons--check-circle]" />
											</Match>
											<Match when={mcp.status === 'disconnected'}>
												<span class="icon-[heroicons--x-circle]" />
											</Match>
										</Switch>
										<span>{mcp.name}</span>
									</Badge>
								</button>
							)}
						</For>
					</div>
				</Show>
				<span class="grow" />
				<div class="[&>button]:first:rounded-l-md [&>button]:rounded-none [&>button]:last:rounded-r-md flex">
					<Show when={props.chatId}>
						<Button
							class="border-px border-r-0"
							onClick={() => {
								navigate({ to: '/chat/$', params: { _splat: 'new' } });
							}}
							size="icon"
							type="button"
							variant="outline"
						>
							<span class="icon-[heroicons--plus] text-xl" />
							<span class="sr-only">New chat</span>
						</Button>
					</Show>
					<Button
						class="border-px flex gap-2 items-center max-w-36 sm:max-w-48 md:max-w-64"
						onClick={() => {
							setChatSettingsDrawerOpen(true);
						}}
						type="button"
						variant="outline"
					>
						<span class="max-sm:hidden text-xs truncate">{modelName()}</span>
						<span class="sr-only">Chat settings</span>
						<span class="shrink-0 icon-[heroicons--cog-6-tooth] text-xl" />
					</Button>
					<Button
						class="border-px"
						onClick={() => {
							setCommandPromptOpen(true);
						}}
						size="icon"
						type="button"
						variant="outline"
					>
						<span class="sr-only">Command prompt</span>
						<span class="icon-[heroicons--command-line] text-xl" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							as={Button<'button'>}
							class="border-px"
							disabled={props.isPending}
							size="icon"
							variant="outline"
						>
							<span class="icon-[heroicons--paper-clip] text-xl" />
							<span class="sr-only">Attach File</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent class="w-48">
							<DropdownMenuItem
								onSelect={async () => {
									const file = await getFile('image/*');
									if (file) emitAttachment(file);
								}}
							>
								<span>Image</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={async () => {
									const file = await getFile('application/epub+zip application/pdf');
									if (file) emitAttachment(file);
								}}
							>
								<span>PDF/Epub</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Show
						fallback={
							<Button onClick={() => props.onAbort()} size="icon" type="button" variant="secondary">
								<span class="icon-[svg-spinners--180-ring-with-bg] text-xl" />
								<span class="sr-only">Cancel</span>
							</Button>
						}
						when={!props.isPending}
					>
						<Button size="icon" type="submit" variant="secondary">
							<span class="icon-[heroicons--arrow-right] text-xl" />
							<span class="sr-only">Send message</span>
						</Button>
					</Show>
				</div>
			</div>
		</div>
	);
}

export default PromptBox;
