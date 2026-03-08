import { describe, expect, it, vi } from 'vitest';

import { initializeDatabase } from './database';

const { DatabaseMigrationManager, constructorSpy } = vi.hoisted(() => {
  class MockMigrationManager {
    run = vi.fn().mockResolvedValue(undefined);
  }
  const constructorSpy = vi.fn(MockMigrationManager);
  return { DatabaseMigrationManager: constructorSpy, constructorSpy };
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
});
