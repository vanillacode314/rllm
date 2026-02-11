import { tables as appTables } from './app-schema';
import { tables as eventTables } from './events-schema';

export const tables = { ...appTables, ...eventTables };
export const { mcps, chats, providers, userMetadata, chatPresets } = appTables;
export const { metadata, events } = eventTables;
