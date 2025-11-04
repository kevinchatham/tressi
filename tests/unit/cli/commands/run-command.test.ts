import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunCommand } from '../../../../src/cli/commands/run-command';
import { loadConfig } from '../../../../src/config';
import { runLoadTest } from '../../../../src/index';
import type { TestSummary } from '../../../../src/types';

// Mock only the essential dependencies
vi.mock('../../../../src/config');
vi.mock('../../../../src/index');

describe('RunCommand', () => {
  let runCommand: RunCommand;

  beforeEach(() => {
    runCommand = new RunCommand();
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should run load test with provided config path', async () => {
      const mockConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [{ url: 'http://example.com', method: 'GET' as const }],
        options: {
          durationSec: 30,
          workers: 1,
          rps: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(runLoadTest).mockResolvedValue({} as TestSummary);

      await runCommand.execute('/custom/path/config.json');

      expect(loadConfig).toHaveBeenCalledWith('/custom/path/config.json');
      expect(runLoadTest).toHaveBeenCalledWith(mockConfig);
    });

    it('should handle config loading errors', async () => {
      const error = new Error('Invalid config');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(runCommand.execute('/invalid/config.json')).rejects.toThrow(
        'Invalid config',
      );
    });

    it('should handle load test execution errors', async () => {
      const mockConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [{ url: 'http://example.com', method: 'GET' as const }],
        options: {
          durationSec: 30,
          workers: 1,
          rps: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(runLoadTest).mockRejectedValue(new Error('Test failed'));

      await expect(runCommand.execute('/config.json')).rejects.toThrow(
        'Test failed',
      );
    });
  });

  describe('getDescription', () => {
    it('should return command description', () => {
      const description = RunCommand.getDescription();
      expect(description).toContain('Run a load test');
    });
  });
});
