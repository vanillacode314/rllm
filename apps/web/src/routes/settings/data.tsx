import { createFileRoute } from '@tanstack/solid-router';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { deleteDatabaseFile, getDatabaseFile } from '~/db/client';
import { setAccount } from '~/signals/account';

export const Route = createFileRoute('/settings/data')({
	component: SettingsStorageComponent
});

function SettingsStorageComponent() {
	async function exportData() {
		const dbFile = await getDatabaseFile();
		const blob = new Blob([dbFile], { type: 'application/vnd.sqlite3' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		a.href = url;
		a.download = `rllm-${timestamp}.db`;
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	function importData() {
		const yes = confirm('Are you sure? This will overwrite your current data.');
		if (!yes) return;
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/vnd.sqlite3';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = async (e) => {
				const data = e.target?.result as ArrayBuffer;
				const dbFile = new Uint8Array(data);
				const opfsRoot = await navigator.storage.getDirectory();
				const fileHandle = await opfsRoot.getFileHandle('rllm:db', { create: false });
				const writer = await fileHandle.createWritable();
				await writer.write(dbFile);
				await writer.close();
				location.reload();
			};
			reader.readAsArrayBuffer(file);
		};
		input.click();
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
					{/* TODO: Test and allow this  */}
					{/* <Button onClick={importData} type="button"> */}
					{/* 	Import Data */}
					{/* </Button> */}
					<Button onClick={deleteAllData} type="button" variant="destructive">
						Delete All Data
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
