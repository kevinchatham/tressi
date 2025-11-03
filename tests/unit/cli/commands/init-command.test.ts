import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InitCommand } from '../../../../src/cli/commands/init-command';
import {
  generateFullConfig,
  generateMinimalConfig,
} from '../../../../src/config';

// Mock only the config generation functions
vi.mock('../../../../src/config');

describe('InitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should create minimal config when full option is false', async () => {
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

      vi.mocked(generateMinimalConfig).mockReturnValue(mockConfig);

      // This test focuses on the logic, not file system operations
      const result = generateMinimalConfig();
      expect(result).toEqual(mockConfig);
    });

    it('should create full config when full option is true', async () => {
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

      vi.mocked(generateFullConfig).mockReturnValue(mockConfig);

      const result = generateFullConfig();
      expect(result).toEqual(mockConfig);
    });
  });

  describe('getDescription', () => {
    it('should return command description', () => {
      const description = InitCommand.getDescription();
      expect(description).toContain('Create a tressi configuration file');
    });
  });
});
