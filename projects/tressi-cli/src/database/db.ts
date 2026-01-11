import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { Kysely, SqliteDialect } from 'kysely';
import { homedir } from 'os';
import { join } from 'path';

import type { Database as DatabaseSchema } from './schema';

const rootDir = join(homedir(), '.tressi');
if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });

const dbPath = join(rootDir, 'tressi.db');

const dialect = new SqliteDialect({
  database: new Database(dbPath),
});

export const db = new Kysely<DatabaseSchema>({
  dialect,
});
