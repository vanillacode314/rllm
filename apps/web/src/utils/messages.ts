import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { Transaction } from 'sqlocal';

import { hashKey } from '@tanstack/solid-query';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { type AsyncResult, Option, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { db } from '~/db/client';
import * as schema from '~/db/schema';
import { processMessage, type TValidMessage, validMessage } from '~/queries/mutations';

import { getLocalClock, setLocalClock } from './clock';
import { setMetadata, withTransaction } from './db';
import { queryClient } from './query-client';
import { optimizeStorage } from './storage';

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

type TUpdate<T extends SQLiteTableWithColumns<any> = SQLiteTableWithColumns<any>> =
	| {
			data: NoInfer<T>['_']['inferSelect'];
			id: string;
			invalidate: Array<string[]>;
			operation: 'insert' | 'update' | 'upsert';
			table: T;
	  }
	| {
			id: string;
			invalidate: Array<string[]>;
			operation: 'delete';
			table: T;
	  };

const applyUpdate = async (
	update: TUpdate,
	timestamp: string,
	opts: { tx?: Transaction } = {}
): Promise<void> => {
	if (!opts.tx) return withTransaction((tx) => applyUpdate(update, timestamp, { tx })).unwrap();

	const tableName = getTableName(update.table);
	const tableColumns = Object.keys(getTableColumns(update.table));
	const columns =
		update.operation !== 'delete' ?
			Object.keys(update.data).filter(
				(column) =>
					column !== 'id' && update.data[column] !== undefined && tableColumns.includes(column)
			)
		:	[];
	// NOTE: ?? should be removed eventually, is there for backwards compat
	const id = update.id ?? nanoid();

	switch (update.operation) {
		case 'delete': {
			await opts.tx.query({
				sql: `DELETE FROM "${tableName}" WHERE "id" = ?`,
				params: [id]
			});
			break;
		}
		case 'insert': {
			const values = columns.map((column) => update.data[column]);
			await opts.tx.query({
				sql: `
              INSERT INTO "${tableName}"(
                "id",
                ${columns.map((column) => `"${column}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columns.map(() => '?').join(',')},
                ?, ?
              )
              ON CONFLICT("id") DO NOTHING`,
				params: [
					id,
					...values,
					timestamp,
					Object.fromEntries(columns.map((column) => [column, timestamp]))
				].map((value) => toSql(value))
			});
			break;
		}
		case 'update': {
			await opts.tx.query({
				sql: `
              UPDATE "${tableName}"
              SET
                ${columns
									.map(
										(column) => `
                      "${column}" = CASE
                          WHEN json_extract(updatedAt, '$.${column}') IS NULL
                               OR json_extract(updatedAt, '$.${column}') < ?
                          THEN ?
                          ELSE "${column}"
                      END
                    `
									)
									.join(',')},
                updatedAt = json_set(
                  updatedAt,
                  ${columns.map((column) => `'$.${column}', ?`).join(', ')}
                )
              WHERE "id" = ?
            `,
				params: [
					...columns.flatMap((col) => [timestamp, update.data[col]]),
					...columns.map(() => timestamp),
					id
				].map(toSql)
			});
			break;
		}
		case 'upsert': {
			const insertSql = `
              INSERT INTO "${tableName}"(
                "id",
                ${columns.map((c) => `"${c}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columns.map(() => '?').join(',')},
                ?, ?
              )
            `;

			const updateSql = `
              SET
                ${columns
									.map(
										(column) => `
                      "${column}" = CASE
                        WHEN json_extract(updatedAt, '$.${column}') IS NULL
                             OR json_extract(updatedAt, '$.${column}') < ?
                        THEN ?
                        ELSE "${column}"
                      END
                    `
									)
									.join(',')},
                updatedAt = json_set(
                  updatedAt,
                  ${columns.map((column) => `'$.${column}', ?`).join(', ')}
                )
            `;

			const upsertSql = `
              ${insertSql}
              ON CONFLICT("id") DO UPDATE
              ${updateSql}
            `;

			const insertParams = [
				id,
				...columns.map((c) => update.data[c]),
				timestamp,
				Object.fromEntries(columns.map((c) => [c, timestamp]))
			].map(toSql);

			const updateParams = [
				...columns.flatMap((c) => [timestamp, update.data[c]]),
				...columns.map(() => timestamp)
			].map(toSql);

			const params = [...insertParams, ...updateParams];

			await opts.tx.query({
				sql: upsertSql,
				params
			});
			break;
		}
	}
};

const applyUpdates = (
	updates: TUpdate[],
	timestamp: string,
	opts: { tx?: Transaction } = {}
): AsyncResult<void, Error> =>
	tryBlock(
		async function* () {
			if (updates.length === 0) return;
			if (!opts.tx) yield* withTransaction((tx) => applyUpdates(updates, timestamp, { tx }));

			const promises = updates.map((update) => applyUpdate(update, timestamp, opts));
			await Promise.all(promises);
		},
		(e) => new Error('Failed to apply updates', { cause: e })
	);

const createMessages = (
	...messages: Array<TValidMessage & { dontLog?: boolean; timestamp?: string }>
) =>
	tryBlock(
		async function* () {
			const validate = Result.wrap(
				validMessage.merge({ 'dontLog?': 'boolean', 'timestamp?': 'string' }).assert,
				(e, value) => {
					console.error('Invalid message', value);
					return new Error(`Invalid message`, { cause: e });
				}
			);
			for (const message of messages) {
				yield* validate(message);
			}
			if (messages.length === 0) return;
			const clock = yield* getLocalClock();

			let updates: TUpdate[] = [];
			yield* withTransaction((tx) =>
				tryBlock(
					async function* () {
						updates = (
							await Promise.all(messages.map((message) => processMessage(message, { tx })))
						).flat();
						for (const message of messages) {
							message.timestamp = clock.increment().toString();
						}
						const messagesToLog = messages.filter(
							(message) => message.dontLog === undefined || !message.dontLog
						);
						if (messagesToLog.length > 0) {
							await tx.query(
								db
									.insert(schema.messages)
									.values(messagesToLog as schema.TMessage[])
									.onConflictDoNothing({
										target: schema.messages.timestamp
									})
							);
						}
						yield* optimizeStorage({ tail: 100, tx });
						yield* setLocalClock(clock, tx);
						yield* applyUpdates(updates, clock.toString(), { tx });
					},
					(e) => e
				)
			);
			await Promise.all(
				updates
					.values()
					.flatMap((update) => update.invalidate)
					.reduce((keys, value) => {
						const hash = hashKey(value);
						if (!keys.has(hash)) keys.set(hash, value);
						return keys;
					}, new Map<string, string[]>())
					.values()
					.map((value) => queryClient.invalidateQueries({ queryKey: value }))
			);
		},
		(e) => new Error('Failed to create messages', { cause: e })
	);

const receiveMessages = (
	messages: Array<schema.TMessage & { syncedAt: string }>,
	tx?: Transaction
): AsyncResult<string[][], Error> =>
	tryBlock<string[][], Error>(
		async function* () {
			if (messages.length === 0) return Result.Ok([]);
			if (!tx) return withTransaction((tx) => receiveMessages(messages, tx));

			const validate = Result.wrap(
				validMessage.merge({ syncedAt: 'string' }).assert,
				(e, value) => {
					console.error('Invalid message', value);
					return new Error(`Invalid message`, { cause: e });
				}
			);
			for (const message of messages) {
				yield* validate(message);
			}
			const clock = yield* getLocalClock(tx);

			let updates: Array<{
				message: Array<schema.TMessage & { syncedAt: string }>[number];
				updates: TUpdate[];
			}> = [];
			await tx.query(
				db.insert(schema.messages).values(messages).onConflictDoNothing({
					target: schema.messages.timestamp
				})
			);
			updates = await Promise.all(
				messages.map(async (message) => {
					return {
						updates: await processMessage(message as unknown as TValidMessage, { tx }),
						message
					};
				})
			);
			for (const { updates: _updates, message } of updates) {
				yield* applyUpdates(_updates, message.timestamp, { tx });
				clock.receive(message.timestamp);
			}

			const lastMessage = Option.from(messages.at(-1)).expect('should have a last message');
			yield* setMetadata('lastPullAt', lastMessage.syncedAt, tx);
			yield* setLocalClock(clock, tx);
			return Result.Ok(
				updates
					.values()
					.flatMap((update) => update.updates)
					.flatMap((update) => update.invalidate)
					.reduce((keys, value) => {
						const hash = hashKey(value);
						if (!keys.has(hash)) keys.set(hash, value);
						return keys;
					}, new Map<string, string[]>())
					.values()
					.toArray()
			);
		},
		(e) => new Error('Failed to receive messages', { cause: e })
	);

export { createMessages, receiveMessages };
export type { TUpdate };
