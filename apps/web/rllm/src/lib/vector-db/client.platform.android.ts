import type { TVectorDB } from 'vector-db';

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { createVectorDB } from 'vector-db';
import { fromCapacitorSqlite } from 'vector-db/capacitorjs';

import * as rag from '~/workers/rag';

import { VECTOR_DATABASE_PATH } from './client.constants';
import { createVectorDbProxy } from './proxy';

const sqlite = new SQLiteConnection(CapacitorSQLite);
async function getDb() {
  await sqlite.checkConnectionsConsistency();
  const { result: hasConnection } = await sqlite.isConnection(VECTOR_DATABASE_PATH, false);
  const db = hasConnection
    ? await sqlite.retrieveConnection(VECTOR_DATABASE_PATH, false)
    : await sqlite.createConnection(VECTOR_DATABASE_PATH, false, 'secret', 1, false);
  const { result: isOpen } = await db.isDBOpen();
  if (!isOpen) await db.open();
  return db;
}

let dbPromise: null | Promise<TVectorDB> = null;
function loadVectorDb() {
  return (dbPromise ??= createVectorDB({
    db: fromCapacitorSqlite('permanent', getDb),
    embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
  }));
}

export const vectorDb = createVectorDbProxy(loadVectorDb);
