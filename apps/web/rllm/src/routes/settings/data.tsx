import { createFileRoute } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { Button } from 'ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';

import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { db } from '~/db/client';
import { MAIN_DATABASE_NAME } from '~/db/client.constants';
import { VECTOR_DATABASE_NAME } from '~/lib/vector-db/client.constants';
import { TRANSIENT_VECTOR_DATABASE_NAME } from '~/lib/vector-db/transient.constants';
import { setAccount } from '~/signals/account';
import { getFile } from '~/utils/files';
import { round } from '~/utils/math';
import { clearData, getDatabaseSize } from '~/utils/storage';

import { EXPORT_VERSION, migrateExport, type TExportData } from './-data-migrations';

export const Route = createFileRoute('/settings/data')({
  component: SettingsStorageComponent,
  async loader() {
    const size = (
      await Promise.all([
        getDatabaseSize(MAIN_DATABASE_NAME),
        getDatabaseSize(VECTOR_DATABASE_NAME),
        getDatabaseSize(TRANSIENT_VECTOR_DATABASE_NAME)
      ])
    ).reduce((sum, n) => sum + n, 0);
    return { size };
  }
});

async function buildExportData(): Promise<TExportData> {
  return { ...(await db.exportData()), version: EXPORT_VERSION };
}

function downloadExport(data: TExportData): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `rllm-${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

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
    downloadExport(await buildExportData());
  }

  async function exportDataWithoutChats() {
    const json = await buildExportData();
    json.chats = [];
    json.userMetadata = json.userMetadata.filter(
      (metadata) => metadata.id !== USER_METADATA_KEYS.SCRATCHPAD_CHAT
    );
    downloadExport(json);
  }

  async function importData() {
    const yes = confirm('Are you sure? This will overwrite your current data.');
    if (!yes) return;
    const file = await getFile('application/json');
    if (!file) {
      toast.error('No file selected');
      return;
    }
    await db.importData(migrateExport(JSON.parse(await file.text()) as TExportData));
  }

  async function deleteAllData() {
    const yes = confirm(
      'Are you sure? This will remove all your data from this device and log you out.'
    );
    if (!yes) return;
    setAccount(null);
    await clearData();
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
            {data().size !== null ? formatBytes(data().size!) : 'Unknown'} currently in use
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
          <Button onClick={exportDataWithoutChats} type="button">
            Export Without Chats
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
