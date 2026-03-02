import { expect, test } from '@playwright/test';
import { MockAgent, setGlobalDispatcher } from 'undici';

import { loadConfig } from '../../cli/src/core/config';

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
  let mockAgent: MockAgent;

  test.beforeAll(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  test.afterEach(() => {
    mockAgent.assertNoPendingInterceptors();
  });

  test.afterAll(async () => {
    await mockAgent.close();
  });

  test('should load config from a direct object', async () => {
    const result = await loadConfig(minimalConfig);
    expect(result.config).toEqual(expectedConfig);
  });

  test('should return validation errors for invalid config', async () => {
    const invalidConfig = { ...minimalConfig, requests: 'not-an-array' };
    await expect(loadConfig(invalidConfig as any)).rejects.toThrow();
  });

  test('should return merge errors for config with missing required fields', async () => {
    const invalidConfig = {
      ...minimalConfig,
      requests: [{}],
    };
    await expect(loadConfig(invalidConfig as any)).rejects.toThrow();
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

  test('should correctly parse a config with per-request headers', async () => {
    const configWithHeaders = {
      $schema: 'https://example.com/schema.json',
      options: {
        headers: {
          Authorization: 'Bearer global-token',
        },
        durationSec: 10,
        rampUpDurationSec: 0,
        workerMemoryLimit: 128,
        threads: 4,
        workerEarlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
          monitoringWindowMs: 5000,
        },
      },
      requests: [
        {
          url: 'http://localhost:8080/test',
          method: 'GET' as const,
          headers: {
            'X-Request-ID': '123',
          },
          rps: 10,
          rampUpDurationSec: 0,
          payload: {},
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      ],
    };

    const parsedConfig = await loadConfig(configWithHeaders);

    expect(parsedConfig.config.requests[0].headers).toEqual({
      'X-Request-ID': '123',
    });
    expect(parsedConfig.config.options.headers).toEqual({
      Authorization: 'Bearer global-token',
    });
  });
});
