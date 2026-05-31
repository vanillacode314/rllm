import type { TEventTransformer } from 'event-logger';

import { getTableName } from 'drizzle-orm';
import { HLC } from 'hlc';
import * as z from 'zod/mini';

import { tables } from '~/db/app-schema';

export const validEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('createMcp'),
    data: z.object({
      id: z.string(),
      name: z.string(),
      url: z.string()
    })
  }),
  z.object({
    type: z.literal('updateMcp'),
    data: z.object({
      id: z.string(),
      name: z.optional(z.string()),
      url: z.optional(z.string())
    })
  }),
  z.object({
    type: z.literal('deleteMcp'),
    data: z.object({
      id: z.string()
    })
  }),
  z.object({
    type: z.literal('createProvider'),
    data: z.object({
      id: z.string(),
      name: z.string(),
      type: z.literal('openai'),
      baseUrl: z.string(),
      token: z.string(),
      defaultModelIds: z.array(z.string().check(z.minLength(1)).check(z.minLength(1)))
    })
  }),
  z.object({
    type: z.literal('updateProvider'),
    data: z.object({
      id: z.string(),
      name: z.optional(z.string()),
      type: z.optional(z.literal('openai')),
      baseUrl: z.optional(z.string()),
      token: z.optional(z.string()),
      defaultModelIds: z.optional(z.array(z.string().check(z.minLength(1)).check(z.minLength(1))))
    })
  }),
  z.object({
    type: z.literal('deleteProvider'),
    data: z.object({
      id: z.string()
    })
  }),
  z.object({
    type: z.literal('createChat'),
    data: z.object({
      id: z.string(),
      title: z.string(),
      tags: z.optional(z.array(z.string().check(z.minLength(1)))),
      finished: z.optional(z.boolean()),
      messages: z.looseObject({}),
      settings: z.looseObject({})
    })
  }),
  z.object({
    type: z.literal('updateChat'),
    data: z.object({
      id: z.string(),
      title: z.optional(z.string()),
      tags: z.optional(z.array(z.string().check(z.minLength(1)))),
      finished: z.optional(z.boolean()),
      messages: z.optional(z.looseObject({})),
      settings: z.optional(z.looseObject({}))
    })
  }),
  z.object({
    type: z.literal('deleteChat'),
    data: z.object({
      id: z.string()
    })
  }),
  z.object({
    type: z.literal('incrementChatAccessCount'),
    data: z.object({ id: z.string() })
  }),
  z.object({
    type: z.literal('setUserMetadata'),
    data: z.object({
      id: z.string(),
      value: z.string()
    })
  }),
  z.object({
    type: z.literal('createPreset'),
    data: z.object({
      id: z.string(),
      name: z.string(),
      settings: z.looseObject({})
    })
  }),
  z.object({
    type: z.literal('updatePreset'),
    data: z.object({
      id: z.string(),
      name: z.optional(z.string()),
      settings: z.optional(z.looseObject({}))
    })
  }),
  z.object({
    type: z.literal('deletePreset'),
    data: z.object({
      id: z.string()
    })
  })
]);

export type TValidEvent = z.infer<typeof validEventSchema>;

const userIntentToTable = new Map(
  Object.entries({
    createMcp: tables.mcps,
    createProvider: tables.providers,
    createChat: tables.chats,
    createPreset: tables.chatPresets,
    deleteChat: tables.chats,
    incrementChatAccessCount: tables.chats,
    deleteMcp: tables.mcps,
    deleteProvider: tables.providers,
    deletePreset: tables.chatPresets,
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
          operation: 'insert',
          table: tableName,
          id: event.data.id,
          data: event.data,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', event.data.id]
          ]
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
          operation: 'delete',
          table: tableName,
          id,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', id]
          ]
        }
      ];
    }
    case 'incrementChatAccessCount': {
      const id = event.data.id;
      const hlc = HLC.fromString(event.timestamp);
      return [
        {
          creates: false,
          operation: 'sql',
          id,
          table: tableName,
          sql: `UPDATE ${tableName} SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`,
          modifiesColumns: [tables.chats.access_count.name, tables.chats.last_accessed_at.name],
          params: [hlc.physicalTime, id],
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', id]
          ]
        }
      ];
    }
    case 'setUserMetadata': {
      return [
        {
          operation: 'upsert',
          table: tableName,
          id: event.data.id,
          data: event.data,
          invalidate: [
            ['db', 'userMetadata', 'all'],
            ['db', 'userMetadata', 'byId', event.data.id]
          ]
        }
      ];
    }
    case 'updateChat':
    case 'updateMcp':
    case 'updatePreset':
    case 'updateProvider': {
      return [
        {
          operation: 'update',
          table: tableName,
          id: event.data.id,
          data: event.data,
          invalidate: [
            ['db', tableName, 'all'],
            ['db', tableName, 'byId', event.data.id]
          ]
        }
      ];
    }
  }
};
