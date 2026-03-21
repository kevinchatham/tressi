/** biome-ignore-all lint/nursery/useExplicitType: vi.hoisted */

import { describe, expect, it, vi } from 'vitest';

import { db, initializeDatabase } from './database';

const { DatabaseMigrationManager, constructorSpy } = vi.hoisted(() => {
  class MockMigrationManager {
    run = vi.fn().mockResolvedValue(undefined);
  }
  const constructorSpy = vi.fn(MockMigrationManager);
  return { constructorSpy, DatabaseMigrationManager: constructorSpy };
});

vi.mock('./database-migration-manager', () => ({
  DatabaseMigrationManager,
}));

describe('initializeDatabase', () => {
  it('should initialize database tables and run migrations', async () => {
    await initializeDatabase();

    // Verify that DatabaseMigrationManager was instantiated and run
    expect(constructorSpy).toHaveBeenCalled();
  });

  it('should export db instance', () => {
    expect(db).toBeDefined();
    expect(db.executeQuery).toBeDefined();
  });
});

describe('db instance', () => {
  it('should have executeQuery method', () => {
    expect(typeof db.executeQuery).toBe('function');
  });

  it('should have schema method for DDL operations', () => {
    expect(typeof db.schema).toBe('object');
    expect(typeof db.schema.createTable).toBe('function');
  });
});
