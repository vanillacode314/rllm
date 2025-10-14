import type { DialogRootProps } from '@kobalte/core/dialog';
import type { Component, ComponentProps, ParentProps, VoidProps } from 'solid-js';

import * as DialogPrimitive from '@kobalte/core/dialog';
import * as CommandPrimitive from 'cmdk-solid';
import { splitProps } from 'solid-js';

import { cn } from '~/utils/tailwind';

import { Dialog, DialogOverlay, DialogPortal } from './dialog';

const Command: Component<ParentProps<CommandPrimitive.CommandRootProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<CommandPrimitive.CommandRoot
			class={cn(
				'flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground blur-none',
				local.class
			)}
			{...others}
		/>
	);
};

const CommandDialog: Component<ParentProps<DialogRootProps> & { loop?: boolean }> = (props) => {
	const [local, others] = splitProps(props, ['children', 'loop']);

	return (
		<Dialog {...others}>
			<DialogPortal>
				<DialogOverlay />
				<DialogPrimitive.Content class="fixed sm:left-1/2 sm:top-1/2 z-50 grid max-h-screen w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 gap-4 overflow-y-auto border bg-background shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out max-sm:data-[closed]:slide-out-to-top max-sm:data-[expanded]:slide-in-from-top sm:data-[closed]:fade-out-0 sm:data-[expanded]:fade-in-0 sm:data-[closed]:zoom-out-95 sm:data-[expanded]:zoom-in-95 sm:rounded-lg overflow-hidden">
					<Command
						class="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-item]_svg]:size-5"
						loop={local.loop}
					>
						{local.children}
					</Command>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
};

const CommandInput: Component<VoidProps<CommandPrimitive.CommandInputProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<div class="flex items-center border-b px-3" cmdk-input-wrapper="">
			<svg
				class="mr-2 size-4 shrink-0 opacity-50"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
				<path d="M21 21l-6 -6" />
			</svg>
			<CommandPrimitive.CommandInput
				class={cn(
					'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
					local.class
				)}
				{...others}
			/>
		</div>
	);
};

const CommandList: Component<ParentProps<CommandPrimitive.CommandListProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<CommandPrimitive.CommandList
			class={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', local.class)}
			{...others}
		/>
	);
};

const CommandEmpty: Component<ParentProps<CommandPrimitive.CommandEmptyProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<CommandPrimitive.CommandEmpty
			class={cn('py-6 text-center text-sm', local.class)}
			{...others}
		/>
	);
};

const CommandGroup: Component<ParentProps<CommandPrimitive.CommandGroupProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<CommandPrimitive.CommandGroup
			class={cn(
				'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
				local.class
			)}
			{...others}
		/>
	);
};

const CommandSeparator: Component<VoidProps<CommandPrimitive.CommandSeparatorProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<CommandPrimitive.CommandSeparator class={cn('h-px bg-border', local.class)} {...others} />
	);
};

const CommandItem: Component<ParentProps<CommandPrimitive.CommandItemProps>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<CommandPrimitive.CommandItem
			class={cn(
				'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
				local.class
			)}
			cmdk-item=""
			{...others}
		/>
	);
};

const CommandShortcut: Component<ComponentProps<'span'>> = (props) => {
	const [local, others] = splitProps(props, ['class']);

	return (
		<span
			class={cn('ml-auto text-xs tracking-widest text-muted-foreground', local.class)}
			{...others}
		/>
	);
};

export {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut
};
