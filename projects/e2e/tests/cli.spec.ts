import { expect, test } from '@playwright/test';
import {
  defaultTressiConfig,
  defaultTressiRequestConfig,
} from '@tressi/shared/common';
import fs from 'fs';
import path from 'path';

import { baseURL } from '../playwright.config';
import { execute } from '../utils';

test.describe('CLI Integration', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const cliPath = path.join(rootDir, 'dist/cli.js');
  const testConfigPath = path.join(__dirname, 'test-config.json');
  const reportPath = path.join(__dirname, 'reports');

  test.beforeEach(() => {
    // Clean up any existing test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    if (fs.existsSync(reportPath)) {
      fs.rmSync(reportPath, { recursive: true, force: true });
    }
  });

  test.afterAll(() => {
    if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
    if (fs.existsSync(reportPath)) {
      fs.rmSync(reportPath, { recursive: true, force: true });
    }
  });

  test('should execute a basic load test', async () => {
    const config = defaultTressiConfig;

    const req = defaultTressiRequestConfig;
    req.method = 'GET';
    req.url = `${baseURL}/api/health`;
    req.rps = 10;

    config.requests.push(req);

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));

    const command = `node ${cliPath} run ${testConfigPath}`;

    const stdout = await execute(command).output;

    // In silent mode, we expect minimal output
    expect(stdout.includes('Report Information'));
  });

  test('should run tressi run and export reports', async () => {
    const config = defaultTressiConfig;

    const req = defaultTressiRequestConfig;
    req.url = `${baseURL}/api/health`;
    req.rps = 10;

    config.requests.push(req);

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
    const command = `node ${cliPath} run ${testConfigPath} --export ${reportPath}`;
    await execute(command).output;
    // Verify report directory exists
    expect(fs.existsSync(reportPath)).toBe(true);

    const summaryPath = path.join(reportPath, 'summary.json');
    const xlsxPath = path.join(reportPath, 'results.xlsx');
    const mdPath = path.join(reportPath, 'report.md');

    // Verify all report files exist
    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(fs.existsSync(xlsxPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);

    // Verify report content
    const report = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    expect(report).toHaveProperty('tressiVersion');
    expect(report).toHaveProperty('configSnapshot');
    expect(report).toHaveProperty('global');
    expect(report).toHaveProperty('endpoints');
  });
});
