import { describe, expect, it, vi } from 'vitest';

import { JsonMigrationManager } from '../data/json-migration-manager';
import { MigrateCommand } from './migrate-command';

vi.mock('../data/json-migration-manager', () => {
  const JsonMigrationManagerMock = vi.fn();
  JsonMigrationManagerMock.prototype.migrateFile = vi.fn();
  return { JsonMigrationManager: JsonMigrationManagerMock };
});

describe('MigrateCommand', () => {
  it('should return the correct description', () => {
    expect(MigrateCommand.getDescription()).toBe(
      'Migrate a configuration file to the current version.',
    );
  });

  it('should call migrateFile with the correct arguments', async () => {
    const command = new MigrateCommand();
    const configPath = './test-config.json';
    const force = true;

    await command.execute(configPath, force);

    const migrationManagerInstance =
      vi.mocked(JsonMigrationManager).mock.instances[0];
    expect(migrationManagerInstance.migrateFile).toHaveBeenCalledWith(
      configPath,
      force,
    );
  });

  it('should call migrateFile with default force value (false)', async () => {
    const command = new MigrateCommand();
    const configPath = './test-config.json';

    await command.execute(configPath);

    const migrationManagerInstance =
      vi.mocked(JsonMigrationManager).mock.instances[0];
    expect(migrationManagerInstance.migrateFile).toHaveBeenCalledWith(
      configPath,
      false,
    );
  });
});
