import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig, validateConfig } from '../../src/core/config';
import { ConfigMergeError, ConfigValidationError } from '../../src/types';

const minimalConfig = {
  $schema: 'https://example.com/schema.json',
  requests: [
    {
      url: 'http://localhost:8080/test',
      method: 'GET' as const,
      rps: 10,
      payload: null,
      headers: null,
    },
  ],
  options: {
    durationSec: 10,
    rampUpTimeSec: 0,
    useUI: true,
    silent: false,
    earlyExitOnError: false,
    workerMemoryLimit: 128,
    headers: null,
    exportPath: null,
    threads: 4,
    workerEarlyExit: {
      enabled: false,
      globalErrorRateThreshold: 0.1,
      globalErrorCountThreshold: 100,
      perEndpointThresholds: [],
      workerExitStatusCodes: [],
      monitoringWindowMs: 1000,
      stopMode: 'endpoint' as const,
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
      payload: null,
      headers: null,
    },
  ],
  options: expect.objectContaining({
    durationSec: 10,
    rampUpTimeSec: 0,
    useUI: true,
    silent: false,
    earlyExitOnError: false,
  }),
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
      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        // TypeScript knows result.error is ConfigValidationError | ConfigMergeError
        expect(
          (result as { error: ConfigValidationError }).error,
        ).toBeInstanceOf(ConfigValidationError);
        expect(
          (
            (result as { error: ConfigValidationError })
              .error as ConfigValidationError
          ).fieldErrors,
        ).toContainEqual(
          expect.objectContaining({
            path: 'requests',
            code: 'invalid_type',
          }),
        );
      }
    });

    it('should return merge errors for config with missing required fields', async () => {
      const invalidConfig = {
        ...minimalConfig,
        requests: [{}], // Missing required fields
      };
      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          (
            (result as { error: ConfigValidationError | ConfigMergeError })
              .error as ConfigValidationError | ConfigMergeError
          ).message,
        ).toContain('merge failed');
      }
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
      ).rejects.toThrow('Remote config fetch failed: 500');
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
          useUI: true,
          silent: false,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          exportPath: null,
          threads: 4,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint' as const,
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
            payload: null,
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
