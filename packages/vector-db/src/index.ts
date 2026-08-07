import { nanoid } from 'nanoid';

export interface TSqlDB extends TSqlRunner {
  transaction<T>(callback: (tx: TSqlRunner) => Promise<T>): Promise<T>;
}

export interface TSqlRunner {
  batch(statements: TStatement[]): Promise<void>;
  query<T extends Record<string, unknown>>(statement: TStatement): Promise<T[]>;
}

export type TStatement = {
  params: unknown[];
  sql: string;
};

const VERSION_KEY = 'version';
const INDEX_CHUNK_SIZE = 16;
const QUERY_CHUNK_SIZE = 1000;

const toSql = (value: unknown) => {
  switch (typeof value) {
    case 'boolean':
      return value ? 1 : 0;
    case 'number':
      return value;
    case 'object':
      if (value === null) return null;
      return JSON.stringify(value);
    case 'string':
      return value;
    default:
      throw new Error(`Invalid sql value: ${value}`);
  }
};

export interface TVectorDB {
  deleteDocument(id: string, tx?: TSqlRunner): Promise<void>;
  getVersion: () => Promise<string | undefined>;
  indexDocument(
    document: IteratorObject<string, void, void>,
    opts?: Partial<{ id: string; onProgress: (value: number) => void; tx: TSqlRunner }>
  ): Promise<string>;
  query(
    text: string,
    opts: Partial<{
      afterIndex: number;
      beforeIndex: number;
      documentIds: string[];
      limit: number;
      offset: number;
    }>
  ): Promise<
    Array<{ document_id: string; index: number; similarity: number; text: string }> | undefined
  >;
  setVersion: (version: string, tx?: TSqlRunner) => Promise<void>;
  updateDocument(id: string, document: IteratorObject<string, void, void>): Promise<void>;
}

type TConfig = {
  db: TSqlDB;
  embedder: TEmbedder;
};

type TEmbedder = {
  generateEmbeddings(text: string): ArrayLike<number> | Promise<ArrayLike<number>>;
};

export async function createVectorDB({ db, embedder }: TConfig): Promise<TVectorDB> {
  await db.batch([
    sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` TEXT PRIMARY KEY NOT NULL, \`value\` TEXT NOT NULL);`,
    sql`CREATE TABLE IF NOT EXISTS \`documents\` (\`id\` TEXT PRIMARY KEY NOT NULL, \`document_id\` TEXT NOT NULL, \`index\` INTEGER NOT NULL, \`vector\` BLOB NOT NULL, \`text\` TEXT NOT NULL);`,
    sql`CREATE INDEX IF NOT EXISTS idx_documents_document_id ON \`documents\` (\`document_id\`)`
  ]);

  const vectorDb = {
    async deleteDocument(id, tx = db) {
      await tx.query(sql`DELETE FROM \`documents\` WHERE \`document_id\` = ${id}`);
    },
    async getVersion(tx = db) {
      const rows = await tx.query<{ value: string }>(
        sql`SELECT \`value\` FROM \`metadata\` WHERE \`key\` = ${VERSION_KEY}`
      );
      return rows[0]?.value;
    },
    async indexDocument(document, opts) {
      const { tx } = opts ?? {};
      if (!tx) return db.transaction((tx) => this.indexDocument(document, { ...opts, tx }));
      const documentId = opts?.id ?? nanoid();
      let items = document.take(INDEX_CHUNK_SIZE);
      let offset = 0;
      let lastChunkSize = 0;
      do {
        // oxlint-disable-next-line no-await-in-loop
        const mappedItems = await Promise.all(
          items.map(async (item) => {
            const vector = new Float16Array(await embedder.generateEmbeddings(item));
            return [item, vector] as const;
          })
        );
        if (mappedItems.length === 0) break;
        const vectorLength = mappedItems[0]![1].length;
        for (const [, vector] of mappedItems) {
          if (vector.length !== vectorLength) {
            throw new Error(
              `Inconsistent embedding dimension: expected ${vectorLength}, got ${vector.length}`
            );
          }
        }
        // oxlint-disable-next-line no-await-in-loop
        await tx.query({
          params: mappedItems.flatMap(([item, vector], index) => [
            nanoid(),
            documentId,
            offset + index,
            vector.buffer,
            item
          ]),
          sql: `INSERT INTO \`documents\` (\`id\`, \`document_id\`, \`index\`, \`vector\`, \`text\`) VALUES ${mappedItems.map(() => '(?, ?, ?, ?, ?)').join(', ')}`
        });

        if (opts?.onProgress) {
          opts.onProgress(offset + mappedItems.length);
        }
        items = document.take(INDEX_CHUNK_SIZE);
        lastChunkSize = mappedItems.length;
        offset += lastChunkSize;
      } while (lastChunkSize === INDEX_CHUNK_SIZE);
      return documentId;
    },
    async query(text, { afterIndex, beforeIndex, documentIds, limit = 10, offset = 0 }) {
      if (limit < 1) throw new Error(`Invalid limit: ${limit}`);
      if (documentIds && documentIds.length === 0) return undefined;
      const queryVector = Float16Array.from(await embedder.generateEmbeddings(text));
      const normalizedQueryVector = normalizeVector(queryVector);

      const baseParams: unknown[] = [];

      let filterClause = '';
      if (documentIds) {
        filterClause += ` WHERE \`document_id\` IN (${documentIds.map(() => '?').join(', ')})`;
        baseParams.push(...documentIds);
      }
      if (afterIndex !== undefined) {
        filterClause += ` \`index\` >= ?`;
        baseParams.push(afterIndex);
      }
      if (beforeIndex !== undefined) {
        filterClause += ` \`index\` < ?`;
        baseParams.push(beforeIndex);
      }

      const top: {
        document_id: string;
        index: number;
        similarity: number;
        text: string;
      }[] = [];
      let rows: { document_id: string; index: number; text: string; vector: Uint8Array }[];
      let minSimilarity = Number.NEGATIVE_INFINITY;
      let cursor = 0;
      do {
        // oxlint-disable-next-line no-await-in-loop
        rows = await db.query<{
          document_id: string;
          index: number;
          text: string;
          vector: Uint8Array;
        }>({
          params: [...baseParams, QUERY_CHUNK_SIZE, cursor],
          sql: `SELECT \`document_id\`, \`index\`, \`text\`, \`vector\` FROM \`documents\`${filterClause} ORDER BY \`id\` LIMIT ? OFFSET ?`
        });
        // oxlint-disable-next-line no-await-in-loop
        for (const row of rows) {
          const rowVector = toFloat16(row.vector);
          if (rowVector.length !== queryVector.length) {
            throw new Error(
              `Embedding dimension mismatch: query has ${queryVector.length} dimensions, stored vector has ${rowVector.length}. Re-index documents with the current embedder.`
            );
          }
          const normalizedRowVector = normalizeVector(rowVector);
          const similarity = cosineSimilarity(normalizedQueryVector, normalizedRowVector);
          if (top.length < offset + limit) {
            top.push(Object.assign(row, { similarity }));
          } else if (similarity > minSimilarity) {
            let evict = 0;
            let secondSmallest = Number.POSITIVE_INFINITY;
            for (let i = 1; i < top.length; i++) {
              const candidate = top[i]!.similarity;
              if (candidate < top[evict]!.similarity) {
                secondSmallest = top[evict]!.similarity;
                evict = i;
              } else if (candidate < secondSmallest) {
                secondSmallest = candidate;
              }
            }
            top[evict] = Object.assign(row, { similarity });
            minSimilarity = Math.min(secondSmallest, similarity);
          }
        }
        cursor += QUERY_CHUNK_SIZE;
      } while (rows.length === QUERY_CHUNK_SIZE);
      if (top.length === 0) return undefined;
      top.sort((a, b) => b.similarity - a.similarity);
      return top.slice(offset);
    },
    async setVersion(version, tx = db) {
      await tx.query(
        sql`INSERT OR REPLACE INTO \`metadata\` (\`key\`, \`value\`) VALUES (${VERSION_KEY}, ${version})`
      );
    },
    async updateDocument(id, document) {
      await db.transaction(async (tx) => {
        await vectorDb.deleteDocument(id, tx);
        await vectorDb.indexDocument(document, { id, tx });
      });
    }
  } satisfies TVectorDB;
  return vectorDb;
}

function cosineSimilarity(a: Float16Array, b: Float16Array): number {
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
  }

  return dotProduct;
}

function normalizeVector(vector: Float16Array): Float16Array {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  const normalized = new Float16Array(vector.length);
  if (magnitude === 0) return normalized;
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i]! / magnitude;
  }
  return normalized;
}

function sql(strings: TemplateStringsArray, ...values: unknown[]): TStatement {
  return {
    params: values.map(toSql),
    sql: strings.reduce((sql, part, i) => sql + part + (i < values.length ? '?' : ''), '')
  };
}

function toFloat16(vector: Uint8Array): Float16Array {
  return Float16Array.from(
    new Float16Array(vector.buffer, vector.byteOffset, vector.byteLength / 2)
  );
}
