import { useQuery } from '@tanstack/solid-query';
import { useNavigate } from '@tanstack/solid-router';
import { For, type JSX, Match, Show, splitProps, Switch } from 'solid-js';

import type { TAttachment } from '~/types/chat';

import { queries } from '~/queries';
import { getFile } from '~/utils/files';
import { createMessages } from '~/utils/messages';
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

type Props = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onInput' | 'onSubmit'> & {
	attachments: TAttachment[];
	chatId?: string;
	class?: string | undefined;
	inputRef?: ((el: HTMLTextAreaElement) => void) | HTMLTextAreaElement;
	isPending: boolean;
	onAbort: () => void;
	onDocument: (file: File) => void;
	onImage: (file: File) => void;
	onInput: (value: string) => void;
	onRemoveAttachment: (id: string) => void;
	onSubmit: (prompt: string) => void;
	prompt: string;
};
export function PromptBox(props: Props) {
	const [local, others] = splitProps(props, [
		'class',
		'chatId',
		'inputRef',
		'isPending',
		'onAbort',
		'onDocument',
		'onImage',
		'onInput',
		'onSubmit',
		'onRemoveAttachment',
		'prompt',
		'attachments'
	]);
	return (
		<div class={cn('flex flex-col', local.class)} {...others}>
			<form
				class="contents"
				id="message-form"
				onSubmit={(event) => {
					event.preventDefault();
					local.onSubmit(local.prompt);
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
										onClick={() => local.onRemoveAttachment(attachment.id)}
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
				<Toolbar
					chatId={local.chatId}
					isPending={local.isPending}
					onAbort={local.onAbort}
					onDocument={local.onDocument}
					onImage={local.onImage}
				/>
			</form>
		</div>
	);
}

function Toolbar(props: {
	chatId?: string;
	isPending: boolean;
	onAbort: () => void;
	onDocument: (file: File) => void;
	onImage: (file: File) => void;
}) {
	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const mcpClients = useQuery(() => queries.mcps.all()._ctx.clients(proxyUrl.data));

	const navigate = useNavigate();

	return (
		<div class="flex gap-2 flex-col p-4">
			<div class="flex gap-2">
				<Show when={props.chatId}>
					<Button
						disabled={props.isPending}
						onClick={async () => {
							const yes = confirm('Are you sure you want to delete this chat?');
							if (!yes) return;
							await navigate({ to: '/' });
							await createMessages({
								user_intent: 'delete_chat',
								meta: {
									id: props.chatId!
								}
							}).unwrap();
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
						class="border-px"
						onClick={() => {
							setChatSettingsDrawerOpen(true);
						}}
						size="icon"
						type="button"
						variant="outline"
					>
						<span class="sr-only">Chat settings</span>
						<span class="icon-[heroicons--cog-6-tooth] text-xl" />
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
								onSelect={() => {
									const input = document.createElement('input');
									input.type = 'file';
									input.accept = 'image/*';
									input.onchange = (e) => {
										const file = (e.target as HTMLInputElement).files?.[0];
										if (file) props.onImage(file);
									};
									input.click();
								}}
							>
								<span>Image</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={async () => {
									const file = await getFile('application/epub+zip application/pdf');
									if (file) props.onDocument(file);
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
