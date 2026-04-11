import fs from 'node:fs';
import path from 'node:path';
import {
  defaultTressiConfig,
  defaultTressiRequestConfig,
  type EndpointSummary,
} from '@tressi/shared/common';

import { expect, test } from '../setup/fixtures';
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
      fs.rmSync(reportPath, { force: true, recursive: true });
    }
  });

  test.afterAll(() => {
    if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
    if (fs.existsSync(reportPath)) {
      fs.rmSync(reportPath, { force: true, recursive: true });
    }
  });

  test('should execute a basic load test', async ({ testServer }) => {
    const config = defaultTressiConfig;

    const req = defaultTressiRequestConfig;
    req.method = 'GET';
    req.url = `${testServer}/health`;
    req.rps = 10;

    config.requests = [req];

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));

    const command = `node ${cliPath} run ${testConfigPath}`;

    const stdout = await execute(command).output;

    // In silent mode, we expect minimal output
    expect(stdout.includes('Report Information'));
  });

  test('should run tressi run and export reports', async ({ testServer }) => {
    const config = defaultTressiConfig;

    const req = defaultTressiRequestConfig;
    req.url = `${testServer}/health`;
    req.rps = 10;

    config.requests = [req];

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

  test('should exit early when error rate threshold is exceeded', async ({ testServer }) => {
    const config = { ...defaultTressiConfig };

    const healthReq = { ...defaultTressiRequestConfig };
    healthReq.url = `${testServer}/health`;
    healthReq.rps = 10;

    const errorReq = { ...defaultTressiRequestConfig };
    errorReq.url = `${testServer}/error-50-percent`;
    errorReq.rps = 10;
    errorReq.earlyExit = {
      enabled: true,
      errorRateThreshold: 10,
      exitStatusCodes: [500],
      monitoringWindowSeconds: 1,
    };

    config.requests = [healthReq, errorReq];

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
    const command = `node ${cliPath} run ${testConfigPath} --export ${reportPath}`;
    try {
      await execute(command).output;
    } catch {
      // Expected to fail due to early exit
    }

    const summaryPath = path.join(reportPath, 'summary.json');
    const report = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

    const healthEndpoint = report.endpoints.find((e: EndpointSummary) => e.url.includes('/health'));
    const errorEndpoint = report.endpoints.find((e: EndpointSummary) =>
      e.url.includes('/error-50-percent'),
    );

    expect(healthEndpoint.totalRequests).toBeGreaterThan(90);
    expect(errorEndpoint.totalRequests).toBeLessThan(50);
  });
});
