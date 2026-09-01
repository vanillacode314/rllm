import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { createVectorDB } from 'vector-db';
import { fromCapacitorSqlite } from 'vector-db/capacitorjs';

import * as rag from '~/workers/rag';

import { TRANSIENT_VECTOR_DATABASE_PATH } from './transient.constants';

const sqlite = new SQLiteConnection(CapacitorSQLite);
async function getDb() {
  await sqlite.checkConnectionsConsistency();
  const { result: hasConnection } = await sqlite.isConnection(
    TRANSIENT_VECTOR_DATABASE_PATH,
    false
  );
  const db = hasConnection
    ? await sqlite.retrieveConnection(TRANSIENT_VECTOR_DATABASE_PATH, false)
    : await sqlite.createConnection(TRANSIENT_VECTOR_DATABASE_PATH, false, 'secret', 1, false);
  const { result: isOpen } = await db.isDBOpen();
  if (!isOpen) await db.open();
  return db;
}

export const transientDb = await createVectorDB({
  db: fromCapacitorSqlite('transient', getDb),
  embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
});
