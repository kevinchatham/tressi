import { DatabaseSync } from 'node:sqlite';

import { existsSync, mkdirSync } from 'fs';
import { Kysely } from 'kysely';
import type { IGenericSqlite } from 'kysely-generic-sqlite';
import {
  buildQueryFn,
  GenericSqliteDialect,
  parseBigInt,
} from 'kysely-generic-sqlite';
import { homedir } from 'os';
import { join } from 'path';

import type { Database } from './schema';

const rootDir = join(homedir(), '.tressi');
if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });

const dbPath = join(rootDir, 'tressi.db');
const sqliteDb = new DatabaseSync(dbPath);

function createSqliteExecutor(db: DatabaseSync): IGenericSqlite<DatabaseSync> {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const getStmt = (sql: string) => {
    const stmt = db.prepare(sql);
    stmt.setReadBigInts(true);
    return stmt;
  };

  return {
    db,
    query: buildQueryFn({
      all: (sql, parameters = []) => getStmt(sql).all(...parameters),
      run: (sql, parameters = []) => {
        const { changes, lastInsertRowid } = getStmt(sql).run(...parameters);
        return {
          insertId: parseBigInt(lastInsertRowid),
          numAffectedRows: parseBigInt(changes),
        };
      },
    }),
    close: () => db.close(),
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    iterator: (isSelect, sql, parameters = []) => {
      if (!isSelect) {
        throw new Error('Only support select in stream()');
      }
      return getStmt(sql).iterate(...parameters);
    },
  };
}

export const db = new Kysely<Database>({
  dialect: new GenericSqliteDialect(() => createSqliteExecutor(sqliteDb)),
});
