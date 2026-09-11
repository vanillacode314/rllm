import type { TVectorDB } from 'vector-db';

import { SQLocal } from 'sqlocal';
import { createVectorDB } from 'vector-db';
import { fromSQLocal } from 'vector-db/sqlocal';

import * as rag from '~/workers/rag';

import { VECTOR_DATABASE_PATH } from './client.constants';
import { createVectorDbProxy } from './proxy';

let dbPromise: null | Promise<TVectorDB> = null;
function loadVectorDb() {
  return (dbPromise ??= createVectorDB({
    db: fromSQLocal(
      new SQLocal({
        databasePath: VECTOR_DATABASE_PATH,
        onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
      })
    ),
    embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
  }));
}

export const vectorDb = createVectorDbProxy(loadVectorDb);
