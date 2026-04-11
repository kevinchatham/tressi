import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationManager } from '../data/migration-manager';
import * as terminalModule from '../tui/terminal';
import { MigrateCommand } from './migrate-command';

vi.mock('../data/database', () => ({
  db: {},
}));

describe('MigrateCommand', () => {
  let terminalErrorSpy: ReturnType<typeof vi.spyOn>;
  let terminalPrintSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    terminalErrorSpy = vi.spyOn(terminalModule.terminal, 'error');
    terminalPrintSpy = vi.spyOn(terminalModule.terminal, 'print');
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the correct description', () => {
    expect(MigrateCommand.getDescription()).toBe(
      'Migrate a configuration file to the current version.',
    );
  });

  it('should call migrateFile with the config path', async () => {
    const migrateFileSpy = vi.spyOn(MigrationManager.prototype, 'migrateFile');

    const command = new MigrateCommand();
    const configPath = './test-config.json';

    await command.execute(configPath);

    expect(migrateFileSpy).toHaveBeenCalledWith(configPath);
  });

  it('should handle generic errors and exit with code 1', async () => {
    const error = new Error('Something went wrong');
    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockRejectedValue(error);

    const command = new MigrateCommand();
    const configPath = './test-config.json';

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display ENOENT hint for file not found errors', async () => {
    const error = new Error('ENOENT: no such file or directory');
    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockRejectedValue(error);

    const command = new MigrateCommand();
    const configPath = './nonexistent.json';

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ensure the file path "./nonexistent.json" is correct'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display JSON syntax error hint for SyntaxError', async () => {
    const error = new SyntaxError('Unexpected token');
    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockRejectedValue(error);

    const command = new MigrateCommand();
    const configPath = './invalid-config.json';

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display permission hint for EACCES errors', async () => {
    const error = new Error('EACCES: permission denied');
    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockRejectedValue(error);

    const command = new MigrateCommand();
    const configPath = './protected.json';

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display permission hint for EPERM errors', async () => {
    const error = new Error('EPERM: operation not permitted');
    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockRejectedValue(error);

    const command = new MigrateCommand();
    const configPath = './protected.json';

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle unknown errors (non-Error objects)', async () => {
    const error = 'Unknown error string';
    vi.spyOn(MigrationManager.prototype, 'migrateFile').mockRejectedValue(error);

    const command = new MigrateCommand();
    const configPath = './config.json';

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
