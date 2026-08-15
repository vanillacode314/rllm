// oxlint-disable no-await-in-loop
import type { TSqlRunner } from 'event-logger';

import { nanoid } from 'nanoid';
import { safeParseJson } from 'ts-result-option/utils';
import { z } from 'zod/mini';

export const migrationHooks: Record<
  string,
  Array<{
    after?: (tx: TSqlRunner) => Promise<void>;
    before?: (tx: TSqlRunner) => Promise<void>;
  }>
> = Object.freeze({
  '20260815144442_left_bedlam.sql': [
    {
      after: async function (tx: TSqlRunner) {
        console.log('Migration started for updates table');
        const pageSize = 10;
        const tables = [
          'chats',
          'chatPresets',
          'documents',
          'mcps',
          'providers',
          'userMetadata'
        ] as const;
        for (const table of tables) {
          console.log(`Processing table ${table}`);
          let cursor = '';
          let hasMore = true;
          while (hasMore) {
            const rows = await tx.query<{ id: string; updatedAt: string }>({
              params: [cursor, pageSize + 1],
              sql: `SELECT id, updatedAt FROM ${table} WHERE updatedAt IS NOT NULL AND id > ? ORDER BY id ASC LIMIT ?`
            });
            if (rows.length === 0) break;
            console.log(`Processing ${rows.length} rows`);
            hasMore = rows.length > pageSize;
            if (hasMore) rows.pop();
            cursor = rows[rows.length - 1].id;
            const params: unknown[] = rows.flatMap((row) => {
              const updatedAt = safeParseJson(row.updatedAt, {
                validate: z.record(z.string(), z.string()).parse
              }).expect('updatedAt must be a valid JSON object');
              return Object.entries(updatedAt).flatMap(([column, timestamp]) => [
                nanoid(),
                table,
                row.id,
                column,
                timestamp
              ]);
            });
            if (params.length === 0) continue;
            const sql = `INSERT INTO updates (id, \`table\`, rowId, column, timestamp) VALUES ${Array.from(
              { length: params.length / 5 }
            )
              .map(() => '(?, ?, ?, ?, ?)')
              .join(', ')} 
              ON CONFLICT(\`table\`, rowId, column) 
                DO UPDATE SET timestamp = excluded.timestamp 
              WHERE excluded.timestamp > updates.timestamp
                `;
            await tx.query({ params, sql });
          }
        }
      }
    }
  ]
});
