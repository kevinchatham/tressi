import { exec } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ServerManager } from '../setup/server-manager';

const execAsync = promisify(exec);

describe('Tressi CLI Commands E2E Tests', () => {
  const configPath = join(process.cwd(), 'tressi.test.config.json');
  let serverManager: ServerManager;
  let baseUrl: string;

  beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  afterAll(async () => {
    await serverManager.stop();
    // Final cleanup
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  });

  beforeEach(() => {
    // Clean up any existing test config file
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  });

  describe('run command', () => {
    beforeEach(async () => {
      // Create a test config using local server for each test
      const testConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        options: {
          durationSec: 2,
          rampUpDurationSec: 0,
        },
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
          },
        ],
      };

      const configContent = JSON.stringify(testConfig, null, 2);
      writeFileSync(configPath, configContent);
    });

    it('should execute a basic load test', async () => {
      const { stdout, stderr } = await execAsync(
        `node dist/cli.js --config ${configPath}`,
        {
          cwd: process.cwd(),
          timeout: 30000, // 30 second timeout for slower systems
        },
      );

      expect(stderr).toBe('');
      // In silent mode, we expect minimal output
      expect(stdout).toBe('');
    });

    it('should handle custom config file path', async () => {
      const customConfigPath = join(process.cwd(), 'custom.test.config.json');
      const testConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        options: {
          durationSec: 1,
          rampUpDurationSec: 0,
        },
        requests: [
          {
            url: `${baseUrl}/success`, // Use success endpoint instead of delay to speed up
            method: 'GET',
          },
        ],
      };

      writeFileSync(customConfigPath, JSON.stringify(testConfig, null, 2));

      try {
        const { stdout, stderr } = await execAsync(
          `node dist/cli.js --config ${customConfigPath}`,
          {
            cwd: process.cwd(),
            timeout: 30000, // 30 second timeout
          },
        );

        expect(stderr).toBe('');
        // In silent mode, we expect minimal output
        expect(stdout).toBe('');
      } finally {
        if (existsSync(customConfigPath)) {
          unlinkSync(customConfigPath);
        }
      }
    });

    it('should handle invalid configuration gracefully', async () => {
      const invalidConfig = {
        options: {
          durationSec: 'invalid',
        },
      };

      writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2));

      try {
        await execAsync(`node dist/cli.js --config ${configPath}`, {
          cwd: process.cwd(),
          timeout: 5000,
        });
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('Validation failed');
      }
    });
  });
});
