import { exec } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

describe('Tressi CLI Commands E2E Tests', () => {
  const testDir = process.cwd();
  const configPath = join(testDir, 'tressi.config.json');

  beforeEach(() => {
    // Clean up any existing config file
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  });

  afterAll(() => {
    // Final cleanup
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  });

  describe('init command', () => {
    it('should create a minimal config file', async () => {
      const { stderr } = await execAsync('npx tressi init', {
        cwd: testDir,
      });

      expect(stderr).toBe('');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
      expect(config.options).toHaveProperty('durationSec');
      expect(config.options).toHaveProperty('workers');
    });

    it('should create a full config file with --full flag', async () => {
      const { stderr } = await execAsync('npx tressi init --full', {
        cwd: testDir,
      });

      expect(stderr).toBe('');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
      expect(config.options).toHaveProperty('durationSec');
      expect(config.options).toHaveProperty('workers');
      expect(config.options).toHaveProperty('rps');
      expect(config.options).toHaveProperty('rampUpTimeSec');
    });

    it('should not overwrite existing config file', async () => {
      // Create initial config
      await execAsync('npx tressi init', { cwd: testDir });

      const originalContent = readFileSync(configPath, 'utf-8');
      const originalConfig = JSON.parse(originalContent);

      // Try to create another config
      const { stderr } = await execAsync('npx tressi init', {
        cwd: testDir,
      });

      expect(stderr).toBe('');
      const newContent = readFileSync(configPath, 'utf-8');
      const newConfig = JSON.parse(newContent);

      expect(newConfig).toEqual(originalConfig);
    });
  });

  describe('config command', () => {
    beforeAll(async () => {
      // Ensure we have a config file
      await execAsync('npx tressi init', { cwd: testDir });
    });

    it('should display configuration in human-readable format', async () => {
      const { stdout, stderr } = await execAsync('npx tressi config', {
        cwd: testDir,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Current Tressi Configuration');
      expect(stdout).toContain('Configuration Source');
      expect(stdout).toContain('Options');
      expect(stdout).toContain('Requests');
    });

    it('should output configuration as JSON with --json flag', async () => {
      const { stdout, stderr } = await execAsync('npx tressi config --json', {
        cwd: testDir,
      });

      expect(stderr).toBe('');
      const config = JSON.parse(stdout);
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
    });

    it('should output raw configuration with --raw flag', async () => {
      const { stdout, stderr } = await execAsync('npx tressi config --raw', {
        cwd: testDir,
      });

      expect(stderr).toBe('');
      const config = JSON.parse(stdout);
      expect(config).toHaveProperty('$schema');
      expect(config).toHaveProperty('options');
      expect(config).toHaveProperty('requests');
    });
  });

  describe('run command', () => {
    beforeAll(async () => {
      // Create a test config
      const testConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        options: {
          durationSec: 2,
          workers: 1,
          rps: 1,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
        requests: [
          {
            url: 'https://httpbin.org/get',
            method: 'GET',
          },
        ],
      };

      const configContent = JSON.stringify(testConfig, null, 2);
      writeFileSync(configPath, configContent);
    });

    it('should execute a basic load test', async () => {
      const { stdout, stderr } = await execAsync('npx tressi', {
        cwd: testDir,
        timeout: 10000, // 10 second timeout
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Load test completed');
      expect(stdout).toContain('Summary');
      expect(stdout).toContain('Requests');
      expect(stdout).toContain('Latency');
    });

    it('should handle custom config file path', async () => {
      const customConfigPath = join(testDir, 'custom.config.json');
      const testConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        options: {
          durationSec: 1,
          workers: 1,
          rps: 1,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
        requests: [
          {
            url: 'https://httpbin.org/get',
            method: 'GET',
          },
        ],
      };

      writeFileSync(customConfigPath, JSON.stringify(testConfig, null, 2));

      try {
        const { stdout, stderr } = await execAsync(
          `npx tressi --config ${customConfigPath}`,
          {
            cwd: testDir,
            timeout: 10000,
          },
        );

        expect(stderr).toBe('');
        expect(stdout).toContain('Load test completed');
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
        await execAsync('npx tressi', {
          cwd: testDir,
          timeout: 5000,
        });
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('Error');
      }
    });
  });
});
