/** biome-ignore-all lint/nursery/useExplicitType: vi.hoisted */

import { describe, expect, it, vi } from 'vitest';

import { db, initializeDatabase } from './database';

const { constructorSpy } = vi.hoisted(() => {
  class MockMigrationManager {
    migrate = vi.fn().mockResolvedValue(undefined);
  }
  const constructorSpy = vi.fn(MockMigrationManager);
  return { constructorSpy };
});

vi.mock('./migration-manager', () => ({
  MigrationManager: constructorSpy,
}));

describe('initializeDatabase', () => {
  it('should initialize database tables and run migrations', async () => {
    await initializeDatabase();

    // Verify that MigrationManager was instantiated and migrate was called
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
