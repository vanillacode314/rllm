import { SQLocal } from 'sqlocal';
import { createVectorDB } from 'vector-db';
import { fromSQLocal } from 'vector-db/sqlocal';

import * as rag from '~/workers/rag';

import { VECTOR_DATABASE_PATH } from './client.constants';

const vectorDbSql = fromSQLocal(new SQLocal({ databasePath: VECTOR_DATABASE_PATH }));

export const vectorDb = await createVectorDB({
  db: vectorDbSql,
  embedder: { generateEmbeddings: (text) => rag.getEmbedding(text) }
});
