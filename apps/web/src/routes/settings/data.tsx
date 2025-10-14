import { createFileRoute } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { db, deleteDatabaseFile, getDatabaseFile, logger } from '~/db/client';
import * as schema from '~/db/schema';
import { setAccount } from '~/signals/account';
import { getFile } from '~/utils/files';

export const Route = createFileRoute('/settings/data')({
	component: SettingsStorageComponent
});

function SettingsStorageComponent() {
	async function exportData() {
		const chats = await db.select().from(schema.chats);
		const mcps = await db.select().from(schema.mcps);
		const providers = await db.select().from(schema.providers);
		const json = { chats, mcps, providers };
		const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		a.href = url;
		a.download = `rllm-${timestamp}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function importData() {
		const yes = confirm('Are you sure? This will overwrite your current data.');
		if (!yes) return;
		const file = await getFile('application/json');
		if (!file) {
			toast.error('No file selected');
			return;
		}
		const { chats, providers, mcps } = JSON.parse(await file.text());
		await Promise.all([
			logger.dispatch(
				...providers.map((provider) => ({
					type: 'createProvider',
					data: provider
				}))
			),
			logger.dispatch(
				...mcps.map((mcp) => ({
					type: 'createMCP',
					data: mcp
				}))
			),
			logger.dispatch(
				...chats.map((chat) => ({
					type: 'createChat',
					data: chat
				}))
			)
		]);
	}

	async function deleteAllData() {
		const yes = confirm(
			'Are you sure? This will remove all your data from this device and log you out.'
		);
		if (!yes) return;
		setAccount(null);
		localStorage.clear();
		await deleteDatabaseFile();
		location.reload();
	}

	return (
		<div class="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Export/Import</CardTitle>
					<CardDescription>Export your data to a file or import it from a file.</CardDescription>
				</CardHeader>
				<CardContent class="flex max-sm:flex-col gap-4">
					<Button onClick={exportData} type="button">
						Export Data
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Danger</CardTitle>
					<CardDescription>The following settings can lead to data loss.</CardDescription>
				</CardHeader>
				<CardContent class="flex max-sm:flex-col gap-4">
					<Button onClick={importData} type="button">
						Import Data
					</Button>
					<Button onClick={deleteAllData} type="button" variant="destructive">
						Delete All Data
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
