import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Helper function to run the CLI as a separate process with timeout
 * @param args Command line arguments
 * @param options Additional options including timeout
 * @returns Promise with exit code, stdout, and stderr
 */
const runCli = (
  args: string[],
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');
    const timeout = options.timeout || 10000; // 10 second default timeout

    const child = spawn('node', [cliPath, ...args], {
      stdio: 'pipe',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 1000);
      reject(new Error(`CLI process timed out after ${timeout}ms`));
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: exitCode || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
};

/**
 * Test suite for the main CLI functionality.
 */
describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test files
    const tempDirs = [
      path.join(__dirname, 'temp-cli-test'),
      path.join(__dirname, 'temp-cli-test-default'),
      path.join(__dirname, 'temp-init-test'),
      path.join(__dirname, 'temp-init-test-existing'),
    ];

    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('main command', () => {
    it('should show help when --help is provided', async () => {
      const result = await runCli(['--help'], { timeout: 5000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        'A modern, simple load testing tool for APIs',
      );
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Options:');
    });

    it('should show version when --version is provided', async () => {
      const result = await runCli(['--version'], { timeout: 5000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should exit with error when no config file is provided and default not found', async () => {
      // Run CLI in a temp directory without tressi.config.json
      const tempDir = path.join(__dirname, 'temp-cli-test');
      await fs.mkdir(tempDir, { recursive: true });

      const result = await runCli([], { cwd: tempDir, timeout: 5000 });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No config file provided');
      expect(result.stderr).toContain('tressi.config.json not found');
    });

    describe('JSON Configuration Support', () => {
      it('should accept JSON configuration file path', async () => {
        // Create a minimal config file that will fail quickly
        const tempConfig = path.join(__dirname, 'temp-config.json');
        const configContent = {
          requests: [
            { url: 'http://localhost:9999/nonexistent', method: 'GET' },
          ],
        };

        await fs.writeFile(tempConfig, JSON.stringify(configContent));

        try {
          const result = await runCli(['--config', tempConfig, '--no-ui'], {
            timeout: 15000,
          });

          // Should exit with error due to network issues, not argument parsing
          expect(result.stderr).not.toContain('error:');
          expect(result.stderr).not.toContain('invalid argument');
        } finally {
          // Clean up
          await fs.unlink(tempConfig).catch(() => {});
        }
      });

      it('should support HTTPS URLs for configuration', async () => {
        // Test that HTTPS URLs are accepted as valid config paths
        const result = await runCli(
          ['--config', 'https://example.com/config.json', '--no-ui'],
          { timeout: 5000 },
        );

        // Should fail due to network issues, not argument parsing
        expect(result.stderr).not.toContain('error: invalid argument');
      });

      it('should support default config file discovery', async () => {
        // Create a temporary directory with tressi.config.json
        const tempDir = path.join(__dirname, 'temp-cli-test-default');
        const configPath = path.join(tempDir, 'tressi.config.json');

        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(
          configPath,
          JSON.stringify({
            requests: [
              { url: 'http://localhost:9999/nonexistent', method: 'GET' },
            ],
          }),
        );

        try {
          const result = await runCli(['--no-ui'], {
            cwd: tempDir,
            timeout: 15000,
          });

          // Should accept the default config without argument errors
          expect(result.stderr).not.toContain('No config file provided');
        } finally {
          // Clean up
          await fs.rm(tempDir, { recursive: true, force: true });
        }
      });
    });

    describe('Short flag support', () => {
      it('should support short flags as aliases for long flags', async () => {
        const tempConfig = path.join(__dirname, 'temp-config-short.json');
        await fs.writeFile(
          tempConfig,
          JSON.stringify({
            requests: [
              { url: 'http://localhost:9999/nonexistent', method: 'GET' },
            ],
          }),
        );

        try {
          // Test both -c and --config work equivalently
          const shortFlagResult = await runCli(['-c', tempConfig, '--no-ui'], {
            timeout: 15000,
          });

          const longFlagResult = await runCli(
            ['--config', tempConfig, '--no-ui'],
            {
              timeout: 15000,
            },
          );

          // Both should handle config loading without argument parsing errors
          expect(shortFlagResult.stderr).not.toContain('error: unknown option');
          expect(longFlagResult.stderr).not.toContain('error: unknown option');
        } finally {
          await fs.unlink(tempConfig).catch(() => {});
        }
      });
    });
  });
});
