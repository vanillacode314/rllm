import { useQuery } from '@tanstack/solid-query';
import { createMemo, createSignal } from 'solid-js';

import { logger } from '~/db/client';
import { openAiAdapter } from '~/lib/adapters/openai';
import { queries } from '~/queries';
import { isMobile } from '~/signals';

import ModelSelector from './ModelSelector';
import ProviderSelector from './ProviderSelector';
import { Button } from './ui/button';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from './ui/drawer';

const [chatSettingsDrawerOpen, setChatSettingsDrawerOpen] = createSignal(false);

function TheChatSettingsDrawer() {
	const selectedProviderId = useQuery(() => queries.userMetadata.byId('selected-provider-id'));
	const selectedModelId = useQuery(() => queries.userMetadata.byId('selected-model-id'));
	const providers = useQuery(() => queries.providers.all());
	const selectedProvider = useQuery(() =>
		queries.providers.byId(
			selectedProviderId.isSuccess ? (selectedProviderId.data ?? undefined) : undefined
		)
	);

	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const proxifyUrl = (url: string) =>
		proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url;

	const fetcher = createMemo(() => {
		const token = selectedProvider.isSuccess ? selectedProvider.data.token : undefined;
		const url = selectedProvider.isSuccess ? proxifyUrl(selectedProvider.data!.baseUrl) : undefined;
		return openAiAdapter.makeFetcher(url, token);
	});

	return (
		<Drawer
			initialFocusEl={document.body}
			onOpenChange={setChatSettingsDrawerOpen}
			open={chatSettingsDrawerOpen()}
			side={isMobile() ? 'top' : 'right'}
		>
			<DrawerContent class="sm:max-w-96 sm:ml-auto sm:h-full top-0 bottom-auto rounded-t-none max-sm:rounded-b-[10px] after:bottom-full after:top-0 after:h-0 mt-0 sm:rounded-l-[10px]">
				<div class="mx-auto w-full max-xs:max-w-sm">
					<DrawerHeader>
						<DrawerTitle>Chat Settings</DrawerTitle>
						<DrawerDescription>Set your chat preferences here.</DrawerDescription>
					</DrawerHeader>
					<div class="p-4 pb-0">
						<div class="grid gap-2">
							<ProviderSelector
								onChange={async (provider) => {
									await logger.dispatch(
										{
											user_intent: 'set_user_metadata',
											meta: { id: 'selected-provider-id', value: provider.id }
										},
										{
											user_intent: 'set_user_metadata',
											meta: { id: 'selected-model-id', value: provider.defaultModelIds[0] }
										}
									);
								}}
								providers={providers.isSuccess ? providers.data : []}
								selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
							/>
							<ModelSelector
								fetcher={fetcher()}
								onChange={async (model) => {
									await logger.dispatch({
										user_intent: 'set_user_metadata',
										meta: { id: 'selected-model-id', value: model.id }
									});
								}}
								selectedModelId={selectedModelId.isSuccess ? selectedModelId.data : null}
								selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
							/>
						</div>
					</div>
					<DrawerFooter>
						<DrawerClose as={Button<'button'>} variant="outline">
							<span class="icon-[heroicons--x-mark-16-solid]" />
							<span>Close</span>
						</DrawerClose>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

export { chatSettingsDrawerOpen, setChatSettingsDrawerOpen };
export default TheChatSettingsDrawer;
