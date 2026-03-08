import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runLoadTest } from '..';
import { loadConfig } from '../core/config';
import { RunCommand } from './run-command';

vi.mock('..', () => ({
  runLoadTest: vi.fn(),
}));

vi.mock('../core/config', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../data/json-migration-manager', () => ({
  JsonMigrationManager: class {
    migrateFile = vi.fn();
    run = vi.fn();
  },
}));

describe('RunCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the correct description', () => {
    expect(RunCommand.getDescription()).toBe(
      'Execute a load test using a local or remote configuration file.',
    );
  });

  it('should execute run command with default config path', async () => {
    const command = new RunCommand();
    const runLoadTestMock = vi.mocked(runLoadTest);
    const loadConfigMock = vi.mocked(loadConfig);

    loadConfigMock.mockResolvedValue({
      config: { name: 'test' },
    } as unknown as Awaited<ReturnType<typeof loadConfig>>);

    await command.execute();

    expect(loadConfigMock).toHaveBeenCalledWith(undefined);
    expect(runLoadTestMock).toHaveBeenCalledWith(
      { name: 'test' },
      undefined,
      undefined,
    );
  });

  it('should execute run command with custom options', async () => {
    const command = new RunCommand();
    const runLoadTestMock = vi.mocked(runLoadTest);
    const loadConfigMock = vi.mocked(loadConfig);

    loadConfigMock.mockResolvedValue({
      config: { name: 'test' },
    } as unknown as Awaited<ReturnType<typeof loadConfig>>);

    await command.execute('custom.json', 'results.json', true, true);

    expect(loadConfigMock).toHaveBeenCalledWith('custom.json');
    expect(runLoadTestMock).toHaveBeenCalledWith(
      { name: 'test' },
      'results.json',
      true,
    );
  });

  it('should throw error if config loading fails', async () => {
    const command = new RunCommand();
    const loadConfigMock = vi.mocked(loadConfig);
    loadConfigMock.mockRejectedValue(new Error('Config Error'));

    await expect(command.execute()).rejects.toThrow('Config Error');
  });
});
