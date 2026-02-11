import {
	createFileRoute,
	Outlet,
	redirect,
	useLocation,
	useNavigate
} from '@tanstack/solid-router';
import { createMemo, For, Show } from 'solid-js';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '~/components/ui/select';
import { SidebarTrigger } from '~/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { SETTINGS_PAGES } from '~/constants/settings';

const filteredPages = () => SETTINGS_PAGES.filter((page) => !page.condition || page.condition());

export const Route = createFileRoute('/settings')({
	component: SettingsComponent,
	beforeLoad: ({ location }) => {
		if (!filteredPages().some((page) => page.path === location.pathname)) {
			throw redirect({ to: filteredPages()[0].path });
		}
	}
});
function SettingsComponent() {
	const location = useLocation();
	const currentPageIndex = createMemo(() =>
		SETTINGS_PAGES.findIndex((page) => page.path === location().pathname)
	);
	const currentPage = () => {
		if (currentPageIndex() === -1) {
			return SETTINGS_PAGES[0];
		}
		return SETTINGS_PAGES[currentPageIndex()];
	};
	const navigate = useNavigate();

	function onChange(value?: string) {
		if (!value) return;
		const index = SETTINGS_PAGES.findIndex((page) => page.path === value);
		navigate({
			to: value,
			viewTransition: {
				types: currentPageIndex() > index ? ['slide-left'] : ['slide-right']
			}
		});
	}

	return (
		<main
			class="h-full content-grid py-4 mx-auto grid-rows-[auto_1fr] content-start gap-y-4 w-full"
			style={{ '--padding-inline': '0px' }}
		>
			<div class="flex justify-between gap-4 items-center px-4">
				<SidebarTrigger />
				<Select
					class="lg:hidden w-full"
					defaultValue={currentPage()}
					itemComponent={(props) => (
						<SelectItem item={props.item}>
							<span class="grid items-center grid-cols-[1.25rem_1fr]">
								<Show when={props.item.rawValue.icon}>
									<span class={props.item.rawValue.icon} />
								</Show>
								<span class="col-start-2 col-end-3">{props.item.rawValue.name}</span>
							</span>
						</SelectItem>
					)}
					onChange={(value) => onChange(value?.path)}
					options={filteredPages()}
					optionTextValue="name"
					optionValue="path"
				>
					<SelectTrigger aria-label="Page">
						<SelectValue<(typeof SETTINGS_PAGES)[number]>>
							{(state) => (
								<span class="flex gap-1 items-center">
									<Show when={state.selectedOption().icon}>
										<span class={state.selectedOption().icon} />
									</Show>
									<span>{state.selectedOption().name}</span>
								</span>
							)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<Tabs
					class="hidden lg:flex justify-self-center"
					onChange={onChange}
					value={currentPage().path}
				>
					<TabsList class="flex gap-2 w-full">
						<For each={filteredPages()}>
							{(page) => (
								<TabsTrigger class="flex gap-1 items-center" value={page.path}>
									<Show when={page.icon}>
										<span class={page.icon} />
									</Show>
									<span>{page.name}</span>
								</TabsTrigger>
							)}
						</For>
					</TabsList>
				</Tabs>
			</div>
			<div class="[view-transition-name:main-content] px-4 overflow-y-auto grid">
				<Outlet />
			</div>
		</main>
	);
}
