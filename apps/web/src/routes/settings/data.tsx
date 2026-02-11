import { createFileRoute } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { db, deleteDatabaseFile, getDatabaseInfo, logger } from '~/db/client';
import * as schema from '~/db/schema';
import { setAccount } from '~/signals/account';
import { getFile } from '~/utils/files';
import { round } from '~/utils/math';

export const Route = createFileRoute('/settings/data')({
	component: SettingsStorageComponent,
	async loader() {
		const info = await getDatabaseInfo();
		return { size: info.databaseSizeBytes ?? null };
	}
});

function formatBytes(value: number): string {
	if (value === 0) {
		return '0 B';
	}

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let i = 0;

	while (value >= 1024 && i < units.length - 1) {
		value /= 1024;
		i++;
	}

	value = round(value, 2);
	return `${value} ${units[i]}`;
}

function SettingsStorageComponent() {
	const data = Route.useLoaderData();
	async function exportData() {
		const [chats, mcps, providers, userMetadata, chatPresets] = await Promise.all([
			db.select().from(schema.chats).orderBy(schema.chats.createdAt),
			db.select().from(schema.mcps).orderBy(schema.mcps.createdAt),
			db.select().from(schema.providers).orderBy(schema.providers.createdAt),
			db.select().from(schema.userMetadata).orderBy(schema.userMetadata.createdAt),
			db.select().from(schema.chatPresets).orderBy(schema.chatPresets.createdAt)
		]);
		const json = { chats, mcps, providers, userMetadata, chatPresets };
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
		const { chats, providers, mcps, userMetadata, chatPresets } = JSON.parse(await file.text());
		await Promise.all([
			logger.dispatch(
				...(providers as (typeof schema.providers.$inferSelect)[]).map((provider) => ({
					type: 'createProvider' as const,
					data: provider
				}))
			),
			logger.dispatch(
				...(mcps as (typeof schema.mcps.$inferSelect)[]).map((mcp) => ({
					type: 'createMcp' as const,
					data: mcp
				}))
			),
			logger.dispatch(
				...(chats as (typeof schema.chats.$inferSelect)[]).map((chat) => ({
					type: 'createChat' as const,
					data: chat
				}))
			),
			logger.dispatch(
				...(userMetadata as (typeof schema.userMetadata.$inferSelect)[]).map((metadata) => ({
					type: 'setUserMetadata' as const,
					data: metadata
				}))
			),
			logger.dispatch(
				...(chatPresets as (typeof schema.chatPresets.$inferSelect)[]).map((preset) => ({
					type: 'createPreset' as const,
					data: preset
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
					<CardTitle>Data Usage</CardTitle>
					<CardDescription>How much local storage your data is using.</CardDescription>
				</CardHeader>
				<CardContent>
					<p class="text-sm font-bold">
						{data().size ? formatBytes(data().size!) : 'Unknown'} currently in use
					</p>
				</CardContent>
			</Card>
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
