import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { createVectorDB } from 'vector-db';
import { fromCapacitorSqlite } from 'vector-db/copacitorjs';

import * as rag from '~/workers/rag';

import { TRANSIENT_VECTOR_DATABASE_PATH } from './transient.constants';

const sqlite = new SQLiteConnection(CapacitorSQLite);
const { result } = await sqlite.checkConnectionsConsistency();
const db = result
  ? await sqlite.retrieveConnection(TRANSIENT_VECTOR_DATABASE_PATH, false)
  : await sqlite.createConnection(TRANSIENT_VECTOR_DATABASE_PATH, false, 'secret', 1, false);
await db.open();

export const transientDb = await createVectorDB({
  db: fromCapacitorSqlite(db),
  embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
});
