import type { TEventTransformer } from 'event-logger';

import { getTableName } from 'drizzle-orm';
import { HLC } from 'hlc';
import * as z from 'zod/mini';

import { tables } from '~/db/app-schema';

export const validEventSchema = z.discriminatedUnion('type', [
  z.object({
    data: z.object({
      id: z.string(),
      name: z.string(),
      url: z.string()
    }),
    type: z.literal('createMcp')
  }),
  z.object({
    data: z.object({
      id: z.string(),
      name: z.optional(z.string()),
      url: z.optional(z.string())
    }),
    type: z.literal('updateMcp')
  }),
  z.object({
    data: z.object({
      id: z.string()
    }),
    type: z.literal('deleteMcp')
  }),
  z.object({
    data: z.object({
      baseUrl: z.string(),
      defaultModelIds: z.array(z.string().check(z.minLength(1)).check(z.minLength(1))),
      id: z.string(),
      name: z.string(),
      token: z.string(),
      type: z.literal('openai')
    }),
    type: z.literal('createProvider')
  }),
  z.object({
    data: z.object({
      baseUrl: z.optional(z.string()),
      defaultModelIds: z.optional(z.array(z.string().check(z.minLength(1)).check(z.minLength(1)))),
      id: z.string(),
      name: z.optional(z.string()),
      token: z.optional(z.string()),
      type: z.optional(z.literal('openai'))
    }),
    type: z.literal('updateProvider')
  }),
  z.object({
    data: z.object({
      id: z.string()
    }),
    type: z.literal('deleteProvider')
  }),
  z.object({
    data: z.object({
      finished: z.optional(z.boolean()),
      id: z.string(),
      messages: z.looseObject({}),
      settings: z.looseObject({}),
      tags: z.optional(z.array(z.string().check(z.minLength(1)))),
      title: z.string()
    }),
    type: z.literal('createChat')
  }),
  z.object({
    data: z.object({
      finished: z.optional(z.boolean()),
      id: z.string(),
      messages: z.optional(z.looseObject({})),
      settings: z.optional(z.looseObject({})),
      tags: z.optional(z.array(z.string().check(z.minLength(1)))),
      title: z.optional(z.string())
    }),
    type: z.literal('updateChat')
  }),
  z.object({
    data: z.object({
      id: z.string()
    }),
    type: z.literal('deleteChat')
  }),
  z.object({
    data: z.object({ id: z.string() }),
    type: z.literal('incrementChatAccessCount')
  }),
  z.object({
    data: z.object({
      id: z.string(),
      value: z.string()
    }),
    type: z.literal('setUserMetadata')
  }),
  z.object({
    data: z.object({
      id: z.string(),
      name: z.string(),
      settings: z.looseObject({})
    }),
    type: z.literal('createPreset')
  }),
  z.object({
    data: z.object({
      id: z.string(),
      name: z.optional(z.string()),
      settings: z.optional(z.looseObject({}))
    }),
    type: z.literal('updatePreset')
  }),
  z.object({
    data: z.object({
      id: z.string()
    }),
    type: z.literal('deletePreset')
  })
]);

export type TValidEvent = z.infer<typeof validEventSchema>;

const userIntentToTable = new Map(
  Object.entries({
    createChat: tables.chats,
    createMcp: tables.mcps,
    createPreset: tables.chatPresets,
    createProvider: tables.providers,
    deleteChat: tables.chats,
    deleteMcp: tables.mcps,
    deletePreset: tables.chatPresets,
    deleteProvider: tables.providers,
    incrementChatAccessCount: tables.chats,
    setUserMetadata: tables.userMetadata,
    updateChat: tables.chats,
    updateMcp: tables.mcps,
    updatePreset: tables.chatPresets,
    updateProvider: tables.providers
  })
);

export const processMessage: TEventTransformer<TValidEvent> = async (event) => {
  const table = userIntentToTable.get(event.type)!;
  const tableName = getTableName(table);
  switch (event.type) {
    case 'createChat':
    case 'createMcp':
    case 'createPreset':
    case 'createProvider': {
      return [
        {
          data: event.type === 'createChat' ? { ...event.data, accessCount: 1 } : event.data,
          id: event.data.id,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', event.data.id]
          ],
          operation: 'insert',
          table: tableName
        }
      ];
    }
    case 'deleteChat':
    case 'deleteMcp':
    case 'deletePreset':
    case 'deleteProvider': {
      const id = event.data.id;
      return [
        {
          id,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', id]
          ],
          operation: 'delete',
          table: tableName
        }
      ];
    }
    case 'incrementChatAccessCount': {
      const id = event.data.id;
      const hlc = HLC.fromString(event.timestamp);
      return [
        {
          creates: false,
          id,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', id]
          ],
          operation: 'sql',
          statements: {
            accessCount: [
              {
                executeEvenIfTimestampIsOlder: true,
                params: [id],
                sql: `UPDATE ${tableName} SET accessCount = accessCount + 1 WHERE id = ?`
              }
            ],
            lastAccessedAt: [
              {
                params: [hlc.physicalTime, id],
                sql: `UPDATE ${tableName} SET lastAccessedAt = ? WHERE id = ?`
              }
            ]
          },
          table: tableName
        }
      ];
    }
    case 'setUserMetadata': {
      return [
        {
          data: event.data,
          id: event.data.id,
          invalidate: [
            ['db', 'userMetadata', 'all'],
            ['db', 'userMetadata', 'byId', event.data.id]
          ],
          operation: 'upsert',
          table: tableName
        }
      ];
    }
    case 'updateChat':
    case 'updateMcp':
    case 'updatePreset':
    case 'updateProvider': {
      return [
        {
          data: event.data,
          id: event.data.id,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', event.data.id]
          ],
          operation: 'update',
          table: tableName
        }
      ];
    }
  }
};
