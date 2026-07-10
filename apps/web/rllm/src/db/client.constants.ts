export const DATABASE_PATH = 'rllm.db';
if (!DATABASE_PATH.endsWith('.db')) throw new Error('DATABASE_PATH must end with .db');
export const DATABASE_NAME = DATABASE_PATH.replace(/\.db$/, '');
