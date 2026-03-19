import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Database as DatabaseSchema } from '@tressi/shared/cli';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';

import { DatabaseMigrationManager } from './database-migration-manager';

const rootDir: string = join(homedir(), '.tressi');
if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });

const dbPath: string = process.env['TRESSI_DB_PATH'] || join(rootDir, 'tressi.db');

const dialect: SqliteDialect = new SqliteDialect({
  database: new Database(dbPath),
});

export const db: Kysely<DatabaseSchema> = new Kysely<DatabaseSchema>({
  dialect,
});

export async function initializeDatabase(): Promise<void> {
  // Enable foreign keys after connection
  db.executeQuery(sql`PRAGMA foreign_keys = ON`.compile(db));

  // Create configs table
  await db.schema
    .createTable('configs')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('config', 'text', (col) => col.notNull())
    .addColumn('epoch_created_at', 'integer', (col) => col.notNull())
    .addColumn('epoch_updated_at', 'integer')
    .execute();

  // Create tests table
  await db.schema
    .createTable('tests')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('config_id', 'text', (col) => col.notNull())
    .addColumn('status', 'text')
    .addColumn('epoch_created_at', 'integer', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('summary', 'text')
    .addForeignKeyConstraint('fk_tests_config', ['config_id'], 'configs', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  // Create metrics table
  await db.schema
    .createTable('metrics')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('test_id', 'text', (col) => col.notNull())
    .addColumn('epoch', 'integer', (col) => col.notNull())
    .addColumn('metric', 'text', (col) => col.notNull())
    .addForeignKeyConstraint('fk_metrics_test', ['test_id'], 'tests', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  // Create performance indexes
  await db.schema
    .createIndex('idx_tests_config_id')
    .ifNotExists()
    .on('tests')
    .column('config_id')
    .execute();

  await db.schema
    .createIndex('idx_metrics_test_id')
    .ifNotExists()
    .on('metrics')
    .column('test_id')
    .execute();

  await db.schema
    .createIndex('idx_metrics_epoch')
    .ifNotExists()
    .on('metrics')
    .column('epoch')
    .execute();

  // Run database migrations
  const migrationManager = new DatabaseMigrationManager(db);
  await migrationManager.run();
}
