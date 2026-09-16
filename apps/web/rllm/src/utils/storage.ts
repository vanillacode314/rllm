import localforage from 'localforage';
import { AsyncResult } from 'ts-result-option';

import { MAIN_DATABASE_NAME } from '~/db/client.constants';
import { VECTOR_DATABASE_NAME } from '~/lib/vector-db/client.constants';
import { TRANSIENT_VECTOR_DATABASE_NAME } from '~/lib/vector-db/transient.constants';

export async function clearData(): Promise<void> {
  await Promise.all([
    deleteDatabaseFile(MAIN_DATABASE_NAME),
    deleteDatabaseFile(VECTOR_DATABASE_NAME),
    deleteDatabaseFile(TRANSIENT_VECTOR_DATABASE_NAME),
    localforage.clear()
  ]);
  localStorage.clear();
}

export async function deleteDatabaseFile(name: string) {
  if (import.meta.env.VITE_MODE === 'android') {
    const { Filesystem } = await import('@capacitor/filesystem');
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    try {
      await Filesystem.deleteFile({
        path: `/data/data/${info.id}/databases/${name}SQLite.db`
      });
    } catch (error) {
      console.error(new Error(`Failed to delete database file`, { cause: error }));
    }
    return;
  }
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(`${name}.db`);
  } catch (error) {
    console.error(new Error(`Failed to delete database file`, { cause: error }));
  }
}

export async function getDatabaseSize(name: string): Promise<number> {
  if (import.meta.env.VITE_MODE === 'android') {
    const { Filesystem } = await import('@capacitor/filesystem');
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    const result = AsyncResult.from(
      () =>
        Filesystem.stat({
          path: `/data/data/${info.id}/databases/${name}SQLite.db`
        }),
      (e) => new Error('Failed to get database size', { cause: e })
    );
    return result
      .map((info) => info.size)
      .inspectErr((e) => console.error(e))
      .unwrapOr(0);
  }
  const result = AsyncResult.from(
    async () => {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(`${name}.db`);
      return await fileHandle.getFile();
    },
    (e) => new Error('Failed to get database size', { cause: e })
  );
  return result
    .map((file) => file.size)
    .inspectErr((e) => console.error(e))
    .unwrapOr(0);
}
