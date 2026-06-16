import { and, eq, gt, sql } from 'drizzle-orm';
import { MerkleTree, stringHasher } from 'merkle-tree';

import { db, type TTransaction } from './client';
import * as schema from './schema';

async function getMerkleTree(
  accountId: string,
  tx?: TTransaction
): Promise<MerkleTree<string, string>> {
  const rows = tx
    ? await tx
        .select({ tree: schema.merkleTrees.tree })
        .from(schema.merkleTrees)
        .where(eq(schema.merkleTrees.accountId, accountId))
    : await db
        .select({ tree: schema.merkleTrees.tree })
        .from(schema.merkleTrees)
        .where(eq(schema.merkleTrees.accountId, accountId));
  if (rows.length === 0) {
    return new MerkleTree(16, stringHasher);
  }
  return MerkleTree.fromString<string, string>(rows[0].tree, stringHasher);
}
async function insertTimestampIntoMerkleTree(
  accountId: string,
  timestamp: string,
  tx?: TTransaction
): Promise<void> {
  if (!tx) return db.transaction((tx2) => insertTimestampIntoMerkleTree(accountId, timestamp, tx2));
  const tree = await getMerkleTree(accountId, tx);
  tree.insert([{ meta: timestamp, value: timestamp }]);
  await tx
    .insert(schema.merkleTrees)
    .values({
      accountId,
      tree: tree.toString()
    })
    .onConflictDoUpdate({
      set: { tree: sql`excluded.tree` },
      target: schema.merkleTrees.accountId
    });
}

async function recomputeMerkleTree(accountId: string, tx?: TTransaction): Promise<void> {
  if (!tx) return db.transaction((tx2) => recomputeMerkleTree(accountId, tx2));
  const tree = new MerkleTree(16, stringHasher);
  let hasNext = true;
  let after: null | string = null;
  const pageSize = 1000;
  while (hasNext) {
    // oxlint-disable-next-line no-await-in-loop
    const rows = await tx
      .select({ timestamp: schema.messages.timestamp })
      .from(schema.messages)
      .where(
        after === null
          ? eq(schema.messages.accountId, accountId)
          : and(eq(schema.messages.accountId, accountId), gt(schema.messages.timestamp, after))
      )
      .orderBy(schema.messages.timestamp)
      .limit(pageSize);
    const items = [];
    for (const row of rows) {
      items.push({ meta: row.timestamp, value: row.timestamp });
    }
    tree.insert(items);
    hasNext = rows.length === pageSize;
    after = rows[rows.length - 1].timestamp ?? null;
  }
  await tx
    .insert(schema.merkleTrees)
    .values({
      accountId,
      tree: tree.toString()
    })
    .onConflictDoUpdate({
      set: { tree: sql`excluded.tree` },
      target: schema.merkleTrees.accountId
    });
}

export { getMerkleTree, insertTimestampIntoMerkleTree, recomputeMerkleTree };
