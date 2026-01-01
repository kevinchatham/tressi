import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/core/config';

const minimalConfig = {
  $schema: 'https://example.com/schema.json',
  requests: [
    {
      url: 'http://localhost:8080/test',
      method: 'GET' as const,
      rps: 10,
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
    rampUpTimeSec: 0,
    silent: false,
    workerMemoryLimit: 128,
    headers: {},
    exportPath: '',
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
    rampUpTimeSec: 0,
    silent: false,
    workerMemoryLimit: 128,
    headers: {},
    exportPath: '',
    threads: 4,
    workerEarlyExit: {
      enabled: false,
      errorRateThreshold: 0,
      exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
      monitoringWindowMs: 5000,
    },
  },
};

let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect(); // prevent actual network requests
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  mockAgent.assertNoPendingInterceptors();
});

afterAll(() => {
  mockAgent.close();
});

/**
 * Test suite for the configuration loading logic.
 */
describe('config', () => {
  /**
   * Tests for the `loadConfig` function.
   */
  describe('loadConfig', () => {
    /**
     * It should be able to take a configuration object directly
     * and return it after validation.
     */
    it('should load config from a direct object', async () => {
      const result = await loadConfig(minimalConfig);
      expect(result.config).toEqual(expectedConfig);
    });

    it('should return validation errors for invalid config', async () => {
      const invalidConfig = { ...minimalConfig, requests: 'not-an-array' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(loadConfig(invalidConfig as any)).rejects.toThrow();
    });

    it('should return merge errors for config with missing required fields', async () => {
      const invalidConfig = {
        ...minimalConfig,
        requests: [{}], // Missing required fields
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(loadConfig(invalidConfig as any)).rejects.toThrow();
    });

    /**
     * It should be able to fetch a configuration file from a remote URL,
     * parse it, and return the validated configuration.
     */
    it('should load config from a remote URL', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/remote-config', method: 'GET' })
        .reply(200, minimalConfig);

      const result = await loadConfig('http://localhost:8080/remote-config');
      expect(result.config).toEqual(expectedConfig);
    });

    /**
     * It should throw a specific error if the remote URL fetch fails
     * (e.g., returns a non-2xx status code).
     */
    it('should throw an error for a failing remote URL', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/remote-config-failing', method: 'GET' })
        .reply(500);

      await expect(
        loadConfig('http://localhost:8080/remote-config-failing'),
      ).rejects.toThrow('Remote config fetch failed with status 500');
    });

    it('should correctly parse a config with per-request headers', async () => {
      const configWithHeaders = {
        $schema: 'https://example.com/schema.json',
        options: {
          headers: {
            Authorization: 'Bearer global-token',
          },
          durationSec: 1,
          rampUpTimeSec: 0,
          silent: false,
          workerMemoryLimit: 128,
          exportPath: '',
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
});
