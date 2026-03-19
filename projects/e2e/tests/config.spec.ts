import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { TressiConfig } from '@tressi/cli';
import { loadConfig } from '@tressi/cli/src/core/config';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { execute } from '../utils';

const minimalConfig = {
  $schema: 'https://example.com/schema.json',
  options: {
    durationSec: 10,
    headers: {},
    rampUpDurationSec: 0,
    threads: 4,
    workerEarlyExit: {
      enabled: false,
      errorRateThreshold: 0,
      exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
      monitoringWindowMs: 1000,
    },
    workerMemoryLimit: 128,
  },
  requests: [
    {
      earlyExit: {
        enabled: false,
        errorRateThreshold: 0,
        exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
        monitoringWindowMs: 1000,
      },
      headers: {},
      method: 'GET' as const,
      payload: {},
      rampUpDurationSec: 0,
      rps: 10,
      url: 'http://localhost:8080/test',
    },
  ],
} as unknown as TressiConfig;

const expectedConfig = {
  $schema: 'https://example.com/schema.json',
  options: {
    durationSec: 10,
    headers: {},
    rampUpDurationSec: 0,
    threads: 4,
    workerEarlyExit: {
      enabled: false,
      errorRateThreshold: 0,
      exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
      monitoringWindowMs: 1000,
    },
    workerMemoryLimit: 128,
  },
  requests: [
    {
      earlyExit: {
        enabled: false,
        errorRateThreshold: 0,
        exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
        monitoringWindowMs: 1000,
      },
      headers: {},
      method: 'GET',
      payload: {},
      rampUpDurationSec: 0,
      rps: 10,
      url: 'http://localhost:8080/test',
    },
  ],
} as unknown as TressiConfig;

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
    mockPool.intercept({ method: 'GET', path: '/remote-config' }).reply(200, minimalConfig);

    const result = await loadConfig('http://localhost:8080/remote-config');
    expect(result.config).toEqual(expectedConfig);
  });

  test('should throw an error for a failing remote URL', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ method: 'GET', path: '/remote-config-failing' }).reply(500);

    await expect(loadConfig('http://localhost:8080/remote-config-failing')).rejects.toThrow(
      'Remote config fetch failed with status 500',
    );
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
