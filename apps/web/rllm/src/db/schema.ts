import { tables as appTables } from './app-schema';
import { tables as eventTables } from './events-schema';

export const tables = { ...appTables, ...eventTables };
export const { chatPresets, chats, mcps, providers, userMetadata } = appTables;
export const { events, metadata } = eventTables;
