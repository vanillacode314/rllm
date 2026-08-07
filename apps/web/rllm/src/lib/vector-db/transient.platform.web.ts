import { SQLocal } from 'sqlocal';
import { createVectorDB } from 'vector-db';
import { fromSQLocal } from 'vector-db/sqlocal';

import * as rag from '~/workers/rag';

import { TRANSIENT_VECTOR_DATABASE_PATH } from './transient.constants';

export const transientDbSql = fromSQLocal(
  new SQLocal({ databasePath: TRANSIENT_VECTOR_DATABASE_PATH })
);

export const transientDb = await createVectorDB({
  db: transientDbSql,
  embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
});
