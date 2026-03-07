import type { Database as DatabaseSchema } from '@tressi/shared/cli';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseMigrationManager } from './database-migration-manager';
import { DATABASE_MIGRATIONS } from './database-migrations';

vi.mock('../../../../package.json', () => ({
  default: { version: '0.0.15' },
}));

vi.mock('./database-migrations', () => ({
  DATABASE_MIGRATIONS: {},
}));

describe('DatabaseMigrationManager', () => {
  let db: Kysely<DatabaseSchema>;
  let manager: DatabaseMigrationManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset DATABASE_MIGRATIONS object since it's shared across tests
    for (const key in DATABASE_MIGRATIONS) {
      delete DATABASE_MIGRATIONS[key];
    }

    const dialect = new SqliteDialect({
      database: new Database(':memory:'),
    });

    db = new Kysely<DatabaseSchema>({
      dialect,
    });

    manager = new DatabaseMigrationManager(db);
  });

  it('should create database_migrations table if it does not exist', async () => {
    await manager.run();

    const tableExists = await db.introspection
      .getTables()
      .then((tables) => tables.some((t) => t.name === 'database_migrations'));

    expect(tableExists).toBe(true);
  });

  it('should do nothing if no migrations are pending', async () => {
    await manager.run();

    const result = await db
      .selectFrom('database_migrations')
      .select('version')
      .execute();

    expect(result).toHaveLength(0);
  });

  it('should apply pending migrations in order', async () => {
    // Mock migrations
    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Create test_table',
      up: async (db): Promise<void> => {
        await db.schema
          .createTable('test_table')
          .addColumn('id', 'integer', (col) => col.primaryKey())
          .execute();
      },
    };

    DATABASE_MIGRATIONS['0.0.15'] = {
      summary: 'Add column to test_table',
      up: async (db): Promise<void> => {
        await db.schema
          .alterTable('test_table')
          .addColumn('name', 'text')
          .execute();
      },
    };

    await manager.run();

    // Verify table and column exist
    const table = await db.introspection
      .getTables()
      .then((tables) => tables.find((t) => t.name === 'test_table'));

    expect(table).toBeDefined();
    expect(table?.columns.some((c) => c.name === 'name')).toBe(true);

    // Verify versions recorded
    const versions = await db
      .selectFrom('database_migrations')
      .select('version')
      .orderBy('version', 'asc')
      .execute();

    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe('0.0.14');
    expect(versions[1].version).toBe('0.0.15');
  });

  it('should only apply migrations up to target version', async () => {
    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Migration 1',
      up: async (): Promise<void> => {},
    };

    DATABASE_MIGRATIONS['0.0.16'] = {
      summary: 'Migration 2 (Future)',
      up: async (): Promise<void> => {},
    };

    await manager.run();

    const versions = await db
      .selectFrom('database_migrations')
      .select('version')
      .execute();

    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('0.0.14');
  });

  it('should roll back and halt if a migration fails', async () => {
    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Successful migration',
      up: async (db): Promise<void> => {
        await db.schema
          .createTable('success_table')
          .addColumn('id', 'integer')
          .execute();
      },
    };

    DATABASE_MIGRATIONS['0.0.15'] = {
      summary: 'Failing migration',
      up: async (): Promise<void> => {
        throw new Error('Migration failed');
      },
    };

    await expect(manager.run()).rejects.toThrow('Migration failed');

    // Verify first migration was applied (it was in its own transaction in my implementation)
    // Wait, my implementation runs EACH migration in its own transaction.
    // So 0.0.14 should be committed, and 0.0.15 should be rolled back.

    const successTableExists = await db.introspection
      .getTables()
      .then((tables) => tables.some((t) => t.name === 'success_table'));
    expect(successTableExists).toBe(true);

    const versions = await db
      .selectFrom('database_migrations')
      .select('version')
      .execute();
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('0.0.14');
  });
});
