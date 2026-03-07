import { expect, test } from '@playwright/test';
import { loadConfig } from '@tressi/cli/src/core/config';
import fs from 'fs';
import path from 'path';
import { MockAgent, setGlobalDispatcher } from 'undici';

import { execute } from '../utils';

const minimalConfig = {
  $schema: 'https://example.com/schema.json',
  requests: [
    {
      url: 'http://localhost:8080/test',
      method: 'GET' as const,
      rps: 10,
      rampUpDurationSec: 0,
      payload: {},
      headers: {},
      earlyExit: {
        enabled: false,
        errorRateThreshold: 0,
        exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
        monitoringWindowMs: 5000,
      },
    },
  ],
  options: {
    durationSec: 10,
    rampUpDurationSec: 0,
    workerMemoryLimit: 128,
    headers: {},
    threads: 4,
    workerEarlyExit: {
      enabled: false,
      errorRateThreshold: 0,
      exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
      monitoringWindowMs: 5000,
    },
  },
};

const expectedConfig = {
  $schema: 'https://example.com/schema.json',
  requests: [
    {
      url: 'http://localhost:8080/test',
      method: 'GET',
      rps: 10,
      rampUpDurationSec: 0,
      payload: {},
      headers: {},
      earlyExit: {
        enabled: false,
        errorRateThreshold: 0,
        exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
        monitoringWindowMs: 5000,
      },
    },
  ],
  options: {
    durationSec: 10,
    rampUpDurationSec: 0,
    workerMemoryLimit: 128,
    headers: {},
    threads: 4,
    workerEarlyExit: {
      enabled: false,
      errorRateThreshold: 0,
      exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
      monitoringWindowMs: 5000,
    },
  },
};

test.describe('Config Loading Integration', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const cliPath = path.join(rootDir, 'dist/cli.js');
  const testConfigPath = path.join(__dirname, 'test-config.json');

  let mockAgent: MockAgent;

  test.beforeEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test.beforeAll(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  test.afterEach(() => {
    mockAgent.assertNoPendingInterceptors();
  });

  test.afterAll(async () => {
    if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
    await mockAgent.close();
  });

  test('should load config from a remote URL', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool
      .intercept({ path: '/remote-config', method: 'GET' })
      .reply(200, minimalConfig);

    const result = await loadConfig('http://localhost:8080/remote-config');
    expect(result.config).toEqual(expectedConfig);
  });

  test('should throw an error for a failing remote URL', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool
      .intercept({ path: '/remote-config-failing', method: 'GET' })
      .reply(500);

    await expect(
      loadConfig('http://localhost:8080/remote-config-failing'),
    ).rejects.toThrow('Remote config fetch failed with status 500');
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
      await execute(command).output;
      throw new Error('Should have thrown an error');
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toBeDefined();
      } else {
        throw new Error(`Caught non-error: ${String(error)}`);
      }
    }
  });
});
