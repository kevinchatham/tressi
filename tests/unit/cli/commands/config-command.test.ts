import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigCommand } from '../../../../src/cli/commands/config-command';
import { displayConfig } from '../../../../src/cli/display/config-display';
import { loadConfig } from '../../../../src/config';
import { TressiConfig } from '../../../../src/types';

// Mock only the external dependencies we need to control
vi.mock('../../../../src/config');
vi.mock('../../../../src/cli/display/config-display');

describe('ConfigCommand', () => {
  let configCommand: ConfigCommand;

  beforeEach(() => {
    configCommand = new ConfigCommand();
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should display configuration with provided config path', async () => {
      const mockConfig: TressiConfig = {
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

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      await configCommand.execute({}, '/custom/path/config.json');

      expect(loadConfig).toHaveBeenCalledWith('/custom/path/config.json');
      expect(displayConfig).toHaveBeenCalledWith(mockConfig, {
        json: undefined,
        raw: undefined,
        source: '/custom/path/config.json',
      });
    });

    it('should display configuration with JSON output when json option is true', async () => {
      const mockConfig: TressiConfig = {
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

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      await configCommand.execute({ json: true }, '/mock/config.json');

      expect(displayConfig).toHaveBeenCalledWith(mockConfig, {
        json: true,
        raw: undefined,
        source: '/mock/config.json',
      });
    });

    it('should display raw configuration when raw option is true', async () => {
      const mockConfig: TressiConfig = {
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

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      await configCommand.execute({ raw: true }, '/mock/config.json');

      expect(displayConfig).toHaveBeenCalledWith(mockConfig, {
        json: undefined,
        raw: true,
        source: '/mock/config.json',
      });
    });

    it('should handle configuration file not found error', async () => {
      const error = new Error('ENOENT: no such file or directory');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(
        configCommand.execute({}, '/nonexistent/config.json'),
      ).rejects.toThrow(
        'Configuration file not found: /nonexistent/config.json',
      );
    });

    it('should handle invalid JSON error', async () => {
      const error = new Error('Unexpected token } in JSON');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(
        configCommand.execute({}, '/invalid/config.json'),
      ).rejects.toThrow('Invalid JSON in configuration file');
    });

    it('should handle generic configuration errors', async () => {
      const error = new Error('Invalid configuration schema');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(
        configCommand.execute({}, '/invalid/config.json'),
      ).rejects.toThrow('Configuration error: Invalid configuration schema');
    });
  });

  describe('getDescription', () => {
    it('should return command description', () => {
      const description = ConfigCommand.getDescription();
      expect(description).toContain(
        'Display the current configuration including all resolved values',
      );
    });
  });
});
