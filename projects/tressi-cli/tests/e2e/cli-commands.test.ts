import { exec } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

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

  describe('init command', () => {
    it('should create a minimal config file', async () => {
      const { stderr } = await execAsync('node dist/cli.js init', {
        cwd: process.cwd(),
      });

      expect(stderr).toBe('');
      expect(existsSync('tressi.config.json')).toBe(true);

      const config = JSON.parse(readFileSync('tressi.config.json', 'utf-8'));
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
      expect(config.options).toHaveProperty('durationSec');

      // Clean up
      if (existsSync('tressi.config.json')) {
        unlinkSync('tressi.config.json');
      }
    });

    it('should create a full config file with --full flag', async () => {
      const { stderr } = await execAsync('node dist/cli.js init --full', {
        cwd: process.cwd(),
      });

      expect(stderr).toBe('');
      expect(existsSync('tressi.config.json')).toBe(true);

      const config = JSON.parse(readFileSync('tressi.config.json', 'utf-8'));
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
      expect(config.options).toHaveProperty('durationSec');
      expect(config.options).not.toHaveProperty('rps');
      expect(config.requests[0]).toHaveProperty('rps');

      // Clean up
      if (existsSync('tressi.config.json')) {
        unlinkSync('tressi.config.json');
      }
    });

    it('should not overwrite existing config file', async () => {
      // Create initial config
      await execAsync('node dist/cli.js init', {
        cwd: process.cwd(),
      });

      const originalContent = readFileSync('tressi.config.json', 'utf-8');
      const originalConfig = JSON.parse(originalContent);

      // Try to create another config
      const { stderr } = await execAsync('node dist/cli.js init', {
        cwd: process.cwd(),
      });

      expect(stderr).toBe('');
      const newContent = readFileSync('tressi.config.json', 'utf-8');
      const newConfig = JSON.parse(newContent);

      expect(newConfig).toEqual(originalConfig);

      // Clean up
      if (existsSync('tressi.config.json')) {
        unlinkSync('tressi.config.json');
      }
    });
  });

  describe('config command', () => {
    beforeEach(async () => {
      // Ensure we have a config file for each test
      await execAsync('node dist/cli.js init', {
        cwd: process.cwd(),
      });
    });

    afterEach(() => {
      // Clean up default config
      if (existsSync('tressi.config.json')) {
        unlinkSync('tressi.config.json');
      }
    });

    it('should display configuration in human-readable format', async () => {
      const { stdout, stderr } = await execAsync('node dist/cli.js config', {
        cwd: process.cwd(),
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Current Tressi Configuration');
      expect(stdout).toContain('Configuration Source');
      expect(stdout).toContain('Options');
      expect(stdout).toContain('Requests');
    });

    it('should output configuration as JSON with --json flag', async () => {
      const { stdout, stderr } = await execAsync(
        'node dist/cli.js config --json',
        { cwd: process.cwd() },
      );

      expect(stderr).toBe('');
      const config = JSON.parse(stdout.trim());
      expect(config).toHaveProperty('config');
      expect(config.config).toHaveProperty('$schema');
      expect(config.config).toHaveProperty('options');
      expect(config.config).toHaveProperty('requests');
    });

    it('should output raw configuration with --raw flag', async () => {
      const { stdout, stderr } = await execAsync(
        'node dist/cli.js config --raw',
        { cwd: process.cwd() },
      );

      expect(stderr).toBe('');
      // Raw should be clean JSON
      const config = JSON.parse(stdout.trim());
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
    });
  });

  describe('run command', () => {
    beforeEach(async () => {
      // Create a test config using local server for each test
      const testConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        options: {
          durationSec: 2,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
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
          useUI: false,
          silent: true,
          earlyExitOnError: false,
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
