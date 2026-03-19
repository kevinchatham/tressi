import * as fs from 'node:fs/promises';

import type { Database as DatabaseSchema } from '@tressi/shared/cli';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseMigrationManager } from './database-migration-manager';
import { DATABASE_MIGRATIONS } from './migrations';

vi.mock('../../../../package.json', () => ({
  default: { version: '0.0.15' },
}));

vi.mock('./database-migrations', () => ({
  DATABASE_MIGRATIONS: {},
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    copyFile: vi.fn(),
  };
});

describe('DatabaseMigrationManager', () => {
  let db: Kysely<DatabaseSchema>;
  let manager: DatabaseMigrationManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock TTY to avoid prompt issues in tests
    process.stdin.isTTY = true;

    // Reset DATABASE_MIGRATIONS object since it's shared across tests
    for (const key in DATABASE_MIGRATIONS) {
      delete DATABASE_MIGRATIONS[key];
    }

    // Mock readline to automatically confirm
    vi.mock('node:readline/promises', () => ({
      createInterface: vi.fn().mockReturnValue({
        close: vi.fn(),
        question: vi.fn().mockResolvedValue('y'),
      }),
    }));

    const dialect = new SqliteDialect({
      database: new Database(':memory:'),
    });

    db = new Kysely<DatabaseSchema>({
      dialect,
    });

    manager = new DatabaseMigrationManager(db);
  });

  it('should create migrations table if it does not exist', async () => {
    await manager.run();

    const tableExists = await db.introspection
      .getTables()
      .then((tables) => tables.some((t) => t.name === 'migrations'));

    expect(tableExists).toBe(true);
  });

  it('should stamp current version on fresh install', async () => {
    await manager.run();

    const result = await db.selectFrom('migrations').select('version').execute();

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('0.0.15');
  });

  it('should create a backup before applying migrations', async () => {
    // Pre-set version to simulate an existing install
    await db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('applied_at', 'integer', (col) => col.notNull())
      .execute();

    await db
      .insertInto('migrations')
      .values({ applied_at: Date.now(), version: '0.0.13' })
      .execute();

    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Test migration',
      up: async (): Promise<void> => {},
    };

    await manager.run();

    expect(fs.copyFile).toHaveBeenCalled();
    const [src, dest] = vi.mocked(fs.copyFile).mock.calls[0] as string[];
    expect(src).toContain('tressi.db');
    expect(dest).toMatch(/tressi-0\.0\.13-\d+\.db\.bak/);
  });

  it('should apply pending migrations in order', async () => {
    // Pre-set version to simulate an existing install
    await db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('applied_at', 'integer', (col) => col.notNull())
      .execute();

    await db
      .insertInto('migrations')
      .values({ applied_at: Date.now(), version: '0.0.13' })
      .execute();

    // Mock migrations
    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Create test_table',
      up: async (db: Kysely<DatabaseSchema>): Promise<void> => {
        await db.schema
          .createTable('test_table')
          .addColumn('id', 'integer', (col) => col.primaryKey())
          .execute();
      },
    };

    DATABASE_MIGRATIONS['0.0.15'] = {
      summary: 'Add column to test_table',
      up: async (db: Kysely<DatabaseSchema>): Promise<void> => {
        await db.schema.alterTable('test_table').addColumn('name', 'text').execute();
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
      .selectFrom('migrations')
      .select('version')
      .orderBy('version', 'asc')
      .execute();

    expect(versions).toHaveLength(3);
    expect(versions[0].version).toBe('0.0.13');
    expect(versions[1].version).toBe('0.0.14');
    expect(versions[2].version).toBe('0.0.15');
  });

  it('should only apply migrations up to target version', async () => {
    // Pre-set version to simulate an existing install
    await db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('applied_at', 'integer', (col) => col.notNull())
      .execute();

    await db
      .insertInto('migrations')
      .values({ applied_at: Date.now(), version: '0.0.13' })
      .execute();

    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Migration 1',
      up: async (): Promise<void> => {},
    };

    DATABASE_MIGRATIONS['0.0.16'] = {
      summary: 'Migration 2 (Future)',
      up: async (): Promise<void> => {},
    };

    await manager.run();

    const versions = await db.selectFrom('migrations').select('version').execute();

    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe('0.0.13');
    expect(versions[1].version).toBe('0.0.14');
  });

  it('should roll back and halt if a migration fails', async () => {
    // Pre-set version to simulate an existing install
    await db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('applied_at', 'integer', (col) => col.notNull())
      .execute();

    await db
      .insertInto('migrations')
      .values({ applied_at: Date.now(), version: '0.0.13' })
      .execute();

    DATABASE_MIGRATIONS['0.0.14'] = {
      summary: 'Successful migration',
      up: async (db: Kysely<DatabaseSchema>): Promise<void> => {
        await db.schema.createTable('success_table').addColumn('id', 'integer').execute();
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

    const versions = await db.selectFrom('migrations').select('version').execute();
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe('0.0.13');
    expect(versions[1].version).toBe('0.0.14');
  });
});
