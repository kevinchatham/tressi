import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.describe('CLI Integration', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const cliPath = path.join(rootDir, 'dist/cli.js');
  const testConfigPath = path.join(__dirname, 'test-config.json');
  const reportPath = path.join(__dirname, 'report.json');
  const dbPath = path.join(__dirname, '../tressi.test.db');

  // Use the webServer URL from playwright.config.ts
  const baseUrl = 'http://localhost:3108';

  test.beforeEach(() => {
    // Clean up any existing test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }
  });

  test.afterAll(() => {
    if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  });

  test('should execute a basic load test', async () => {
    const testConfig = {
      $schema:
        'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
      options: {
        durationSec: 2,
        rampUpDurationSec: 0,
      },
      requests: [
        {
          url: `${baseUrl}/api/health`,
          method: 'GET',
        },
      ],
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    const command = `node ${cliPath} run ${testConfigPath}`;

    const stdout = execSync(command, {
      env: {
        ...process.env,
        TRESSI_DB_PATH: dbPath,
      },
    }).toString();

    // In silent mode, we expect minimal output
    expect(stdout.trim()).toBe('');
  });

  test('should run tressi run and export json report', async () => {
    const config = {
      options: {
        durationSec: 2,
        rampUpDurationSec: 0,
      },
      requests: [
        {
          url: `${baseUrl}/api/health`,
          method: 'GET',
        },
      ],
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));

    const command = `node ${cliPath} run ${testConfigPath} --export json --output ${reportPath}`;

    execSync(command, {
      env: {
        ...process.env,
        TRESSI_DB_PATH: dbPath,
      },
    });

    // Verify report.json exists
    expect(fs.existsSync(reportPath)).toBe(true);

    // Verify report content
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(report).toHaveProperty('testRun');
    expect(report).toHaveProperty('metrics');
  });

  test('should handle custom config file path', async () => {
    const customConfigPath = path.join(__dirname, 'custom.test.config.json');
    const testConfig = {
      options: {
        durationSec: 1,
        rampUpDurationSec: 0,
      },
      requests: [
        {
          url: `${baseUrl}/api/health`,
          method: 'GET',
        },
      ],
    };

    fs.writeFileSync(customConfigPath, JSON.stringify(testConfig, null, 2));

    try {
      const command = `node ${cliPath} run ${customConfigPath}`;
      const stdout = execSync(command, {
        env: {
          ...process.env,
          TRESSI_DB_PATH: dbPath,
        },
      }).toString();

      expect(stdout.trim()).toBe('');
    } finally {
      if (fs.existsSync(customConfigPath)) {
        fs.unlinkSync(customConfigPath);
      }
    }
  });

  test('should handle invalid configuration gracefully', async () => {
    const invalidConfig = {
      options: {
        durationSec: 'invalid',
      },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

    try {
      const command = `node ${cliPath} run ${testConfigPath}`;
      execSync(command, {
        env: {
          ...process.env,
          TRESSI_DB_PATH: dbPath,
        },
        stdio: 'pipe',
      });
      throw new Error('Should have thrown an error');
    } catch (error: any) {
      expect(error.stderr.toString()).toContain('Validation failed');
    }
  });
});
