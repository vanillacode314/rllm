import type { TVectorDB } from 'vector-db';

import { SQLocal } from 'sqlocal';
import { createVectorDB } from 'vector-db';
import { fromSQLocal } from 'vector-db/sqlocal';

import * as rag from '~/workers/rag';

import { createVectorDbProxy } from './proxy';
import { TRANSIENT_VECTOR_DATABASE_PATH } from './transient.constants';

let dbPromise: null | Promise<TVectorDB> = null;
function loadTransientDb() {
  return (dbPromise ??= createVectorDB({
    db: fromSQLocal(
      new SQLocal({
        databasePath: TRANSIENT_VECTOR_DATABASE_PATH,
        onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
      })
    ),
    embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
  }));
}

export const transientDb = createVectorDbProxy(loadTransientDb);
