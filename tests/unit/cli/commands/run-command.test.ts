import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the fs module to avoid file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('../../../../src/validation/config-validator');
vi.mock('../../../../src/index');

// Import after mocking
import { promises as fs } from 'fs';

import { RunCommand } from '../../../../src/cli/commands/run-command';
import { runLoadTest } from '../../../../src/index';
import type { TestSummary } from '../../../../src/types';
import { ConfigValidator } from '../../../../src/validation/config-validator';

describe('RunCommand', () => {
  let runCommand: RunCommand;

  beforeEach(async () => {
    const module = await import('../../../../src/cli/commands/run-command');
    runCommand = new module.RunCommand();
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should run load test with provided config path', async () => {
      const mockConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [{ url: 'http://example.com', method: 'GET' as const }],
        options: {
          durationSec: 30,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(ConfigValidator.validateForCLI).mockReturnValue(mockConfig);
      vi.mocked(runLoadTest).mockResolvedValue({} as TestSummary);

      await runCommand.execute('/custom/path/config.json');

      expect(fs.readFile).toHaveBeenCalledWith(
        '/custom/path/config.json',
        'utf-8',
      );
      expect(ConfigValidator.validateForCLI).toHaveBeenCalledWith(mockConfig);
      expect(runLoadTest).toHaveBeenCalledWith(mockConfig);
    });

    it('should handle config loading errors', async () => {
      const error = new Error('ENOENT: no such file or directory');
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(runCommand.execute('/invalid/config.json')).rejects.toThrow(
        'ENOENT: no such file or directory',
      );
    });

    it('should handle load test execution errors', async () => {
      const mockConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [{ url: 'http://example.com', method: 'GET' as const }],
        options: {
          durationSec: 30,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(ConfigValidator.validateForCLI).mockReturnValue(mockConfig);
      vi.mocked(runLoadTest).mockRejectedValue(new Error('Test failed'));

      await expect(runCommand.execute('/config.json')).rejects.toThrow(
        'Test failed',
      );
    });
  });

  describe('getDescription', () => {
    it('should return command description', async () => {
      const description = RunCommand.getDescription();
      expect(description).toContain('Run a load test');
    });
  });
});
