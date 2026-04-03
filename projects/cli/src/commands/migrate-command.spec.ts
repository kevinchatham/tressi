import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonMigrationManager } from '../data/json-migration-manager';
import * as terminalModule from '../tui/terminal';
import { MigrateCommand } from './migrate-command';

vi.mock('../data/json-migration-manager', () => {
  const JsonMigrationManagerMock = vi.fn();
  JsonMigrationManagerMock.prototype.migrateFile = vi.fn();
  return { JsonMigrationManager: JsonMigrationManagerMock };
});

describe('MigrateCommand', () => {
  let terminalErrorSpy: ReturnType<typeof vi.spyOn>;
  let terminalPrintSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    terminalErrorSpy = vi.spyOn(terminalModule.terminal, 'error');
    terminalPrintSpy = vi.spyOn(terminalModule.terminal, 'print');
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
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
    const command = new MigrateCommand();
    const configPath = './test-config.json';

    await command.execute(configPath);

    const migrationManagerInstance = vi.mocked(JsonMigrationManager).mock
      .instances[0] as unknown as { migrateFile: ReturnType<typeof vi.fn> };
    expect(migrationManagerInstance.migrateFile).toHaveBeenCalledWith(configPath);
  });

  it('should handle generic errors and exit with code 1', async () => {
    const command = new MigrateCommand();
    const configPath = './test-config.json';
    const error = new Error('Something went wrong');

    vi.mocked(JsonMigrationManager).mockImplementation(function (this: unknown) {
      (this as { migrateFile: ReturnType<typeof vi.fn> }).migrateFile = vi
        .fn()
        .mockRejectedValue(error);
    });

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display ENOENT hint for file not found errors', async () => {
    const command = new MigrateCommand();
    const configPath = './nonexistent.json';
    const error = new Error('ENOENT: no such file or directory');

    vi.mocked(JsonMigrationManager).mockImplementation(function (this: unknown) {
      (this as { migrateFile: ReturnType<typeof vi.fn> }).migrateFile = vi
        .fn()
        .mockRejectedValue(error);
    });

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ensure the file path "./nonexistent.json" is correct'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display JSON syntax error hint for SyntaxError', async () => {
    const command = new MigrateCommand();
    const configPath = './invalid-config.json';
    const error = new SyntaxError('Unexpected token');

    vi.mocked(JsonMigrationManager).mockImplementation(function (this: unknown) {
      (this as { migrateFile: ReturnType<typeof vi.fn> }).migrateFile = vi
        .fn()
        .mockRejectedValue(error);
    });

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display permission hint for EACCES errors', async () => {
    const command = new MigrateCommand();
    const configPath = './protected.json';
    const error = new Error('EACCES: permission denied');

    vi.mocked(JsonMigrationManager).mockImplementation(function (this: unknown) {
      (this as { migrateFile: ReturnType<typeof vi.fn> }).migrateFile = vi
        .fn()
        .mockRejectedValue(error);
    });

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display permission hint for EPERM errors', async () => {
    const command = new MigrateCommand();
    const configPath = './protected.json';
    const error = new Error('EPERM: operation not permitted');

    vi.mocked(JsonMigrationManager).mockImplementation(function (this: unknown) {
      (this as { migrateFile: ReturnType<typeof vi.fn> }).migrateFile = vi
        .fn()
        .mockRejectedValue(error);
    });

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalled();
    expect(terminalPrintSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle unknown errors (non-Error objects)', async () => {
    const command = new MigrateCommand();
    const configPath = './config.json';
    const error = 'Unknown error string';

    vi.mocked(JsonMigrationManager).mockImplementation(function (this: unknown) {
      (this as { migrateFile: ReturnType<typeof vi.fn> }).migrateFile = vi
        .fn()
        .mockRejectedValue(error);
    });

    await command.execute(configPath);

    expect(terminalErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
