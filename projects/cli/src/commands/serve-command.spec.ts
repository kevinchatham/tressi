import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServeCommand } from './serve-command';

vi.mock('../data/database', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}));

const mockMigrationManager = {
  run: vi.fn(),
};

const mockServer = {
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

vi.mock('../data/json-migration-manager', () => ({
  JsonMigrationManager: class {
    run = mockMigrationManager.run;
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
    mockMigrationManager.run.mockResolvedValue({});
    mockServer.start.mockResolvedValue({});

    await command.execute({ port: 3000, migrate: true });

    expect(mockMigrationManager.run).toHaveBeenCalledWith(true);
    expect(mockServer.start).toHaveBeenCalled();
  });

  it('should throw error if server fails to start', async () => {
    const command = new ServeCommand();
    mockServer.start.mockRejectedValue(new Error('Server Error'));

    await expect(command.execute({})).rejects.toThrow(
      'Failed to start server: Server Error',
    );
  });
});
