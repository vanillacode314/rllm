import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import type { TChat, TChatPreset, TMCP, TProvider, TUserMetadata } from '~/db/app-schema';
import type { TMessage } from '~/types/chat';
import { type NestedJsonTreeNode, toFlatJsonTree } from '~/utils/tree';

export const EXPORT_VERSION = 2;

export type TExportData = {
  chatPresets: TChatPreset[];
  chats: TChat[];
  mcps: TMCP[];
  providers: TProvider[];
  userMetadata: TUserMetadata[];
  version?: number;
};

function migrateScratchpadChat(value: string): string {
  const chat = JSON.parse(value) as { messages: NestedJsonTreeNode<TMessage> };
  return JSON.stringify({ ...chat, messages: toFlatJsonTree(chat.messages) });
}

/** Source version → migration that upgrades the export by one version. */
const EXPORT_MIGRATIONS: Record<number, (data: TExportData) => TExportData> = {
  /** v1 → v2: converts legacy nested `messages` trees to the flat shape. */
  1: function (data: TExportData): TExportData {
    return {
      ...data,
      chats: data.chats.map((chat) => ({
        ...chat,
        messages: toFlatJsonTree(chat.messages as unknown as NestedJsonTreeNode<TMessage>)
      })),
      userMetadata: data.userMetadata.map((metadata) =>
        metadata.id === USER_METADATA_KEYS.SCRATCHPAD_CHAT && typeof metadata.value === 'string'
          ? { ...metadata, value: migrateScratchpadChat(metadata.value) }
          : metadata
      )
    };
  }
};

export function migrateExport(data: TExportData): TExportData {
  let migrated = data;
  for (let version = data.version ?? 1; version < EXPORT_VERSION; version++) {
    const migrate = EXPORT_MIGRATIONS[version];
    if (!migrate) throw new Error(`Missing export migration for version ${version}`);
    migrated = migrate(migrated);
  }
  return { ...migrated, version: EXPORT_VERSION };
}
