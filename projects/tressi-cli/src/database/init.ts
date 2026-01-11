import { db } from './db';

export async function initializeDatabase() {
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
    .addForeignKeyConstraint(
      'fk_tests_config',
      ['config_id'],
      'configs',
      ['id'],
      (cb) => cb.onDelete('cascade'),
    )
    .execute();

  // Create global_metrics table
  await db.schema
    .createTable('global_metrics')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('test_id', 'text', (col) => col.notNull())
    .addColumn('epoch', 'integer', (col) => col.notNull())
    .addColumn('metric', 'text', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_global_metrics_test',
      ['test_id'],
      'tests',
      ['id'],
      (cb) => cb.onDelete('cascade'),
    )
    .execute();

  // Create endpoint_metrics table
  await db.schema
    .createTable('endpoint_metrics')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('test_id', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('epoch', 'integer', (col) => col.notNull())
    .addColumn('metric', 'text', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_endpoint_metrics_test',
      ['test_id'],
      'tests',
      ['id'],
      (cb) => cb.onDelete('cascade'),
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
    .createIndex('idx_global_metrics_test_id')
    .ifNotExists()
    .on('global_metrics')
    .column('test_id')
    .execute();
  await db.schema
    .createIndex('idx_global_metrics_epoch')
    .ifNotExists()
    .on('global_metrics')
    .column('epoch')
    .execute();
  await db.schema
    .createIndex('idx_endpoint_metrics_test_id')
    .ifNotExists()
    .on('endpoint_metrics')
    .column('test_id')
    .execute();
  await db.schema
    .createIndex('idx_endpoint_metrics_url')
    .ifNotExists()
    .on('endpoint_metrics')
    .column('url')
    .execute();
  await db.schema
    .createIndex('idx_endpoint_metrics_epoch')
    .ifNotExists()
    .on('endpoint_metrics')
    .column('epoch')
    .execute();
}
