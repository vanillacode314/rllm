import { createFileRoute } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { Button } from 'ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';

import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import type { TChat, TChatPreset, TMCP, TProvider, TUserMetadata } from '~/db/app-schema';
import { logger } from '~/db/client';
import { MAIN_DATABASE_NAME } from '~/db/client.constants';
import { VECTOR_DATABASE_NAME } from '~/lib/vector-db/client.constants';
import { TRANSIENT_VECTOR_DATABASE_NAME } from '~/lib/vector-db/transient.constants';
import { setAccount } from '~/signals/account';
import { parseDbRowsInPlace } from '~/utils/db';
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
  const [chats, mcps, providers, userMetadata, chatPresets] = await Promise.all([
    parseDbRowsInPlace(
      logger.db.query<TChat>(logger.sql`SELECT * FROM "chats" ORDER BY "chats"."createdAt"`),
      { booleanKeys: ['finished'], jsonKeys: ['settings', 'messages', 'tags'] }
    ),
    parseDbRowsInPlace(
      logger.db.query<TMCP>(logger.sql`SELECT * FROM "mcps" ORDER BY "mcps"."createdAt"`)
    ),
    parseDbRowsInPlace(
      logger.db.query<TProvider>(
        logger.sql`SELECT * FROM "providers" ORDER BY "providers"."createdAt"`
      ),
      { jsonKeys: ['defaultModelIds'] }
    ),
    logger.db.query<TUserMetadata>(
      logger.sql`SELECT * FROM "userMetadata" ORDER BY "userMetadata"."createdAt"`
    ),
    parseDbRowsInPlace(
      logger.db.query<TChatPreset>(
        logger.sql`SELECT * FROM "chatPresets" ORDER BY "chatPresets"."createdAt"`
      ),
      { jsonKeys: ['settings'] }
    )
  ]);
  return { chatPresets, chats, mcps, providers, userMetadata, version: EXPORT_VERSION };
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
    const { chatPresets, chats, mcps, providers, userMetadata } = migrateExport(
      JSON.parse(await file.text()) as TExportData
    );
    await Promise.all([
      logger.dispatch(
        ...providers.map((provider) => ({
          data: provider,
          type: 'createProvider' as const
        }))
      ),
      logger.dispatch(
        ...mcps.map((mcp) => ({
          data: mcp,
          type: 'createMcp' as const
        }))
      ),
      logger.dispatch(
        ...chats.map((chat) => ({
          data: chat,
          type: 'createChat' as const
        }))
      ),
      logger.dispatch(
        ...userMetadata.map((metadata) => ({
          data: metadata,
          type: 'setUserMetadata' as const
        }))
      ),
      logger.dispatch(
        ...chatPresets.map((preset) => ({
          data: preset,
          type: 'createPreset' as const
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
