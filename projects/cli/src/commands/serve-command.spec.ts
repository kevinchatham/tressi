import type { Procedure } from '@vitest/spy';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ServeCommand } from './serve-command';

vi.mock('../data/database', () => ({
  db: {},
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}));

const mockMigrationManager: { migrate: Mock<Procedure> } = {
  migrate: vi.fn(),
};

const mockServer: { start: Mock<Procedure>; stop: Mock<Procedure> } = {
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock('../server', () => ({
  TressiServer: class {
    start = mockServer.start;
    stop = mockServer.stop;
    constructor(public port?: number) {}
  },
}));

vi.mock('../data/migration-manager', () => ({
  MigrationManager: class {
    migrate = mockMigrationManager.migrate;
  },
}));

describe('ServeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the correct description', () => {
    expect(ServeCommand.getDescription()).toBe(
      'Start the management server and interactive dashboard.',
    );
  });

  it('should execute serve command and start server', async () => {
    const command = new ServeCommand();
    mockMigrationManager.migrate.mockResolvedValue({});
    mockServer.start.mockResolvedValue({});

    await command.execute({ port: 3000 });

    expect(mockMigrationManager.migrate).toHaveBeenCalled();
    expect(mockServer.start).toHaveBeenCalled();
  });

  it('should throw error if server fails to start', async () => {
    const command = new ServeCommand();
    mockMigrationManager.migrate.mockResolvedValue({});
    mockServer.start.mockRejectedValue(new Error('Server Error'));

    await expect(command.execute({})).rejects.toThrow('Failed to start server: Server Error');
  });
});
