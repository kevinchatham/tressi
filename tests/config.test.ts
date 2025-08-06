import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig, TressiConfig, TressiConfigSchema } from '../src/config';

const minimalConfig = {
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' as const }],
};

const expectedConfig = {
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' }],
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
      const config = await loadConfig(minimalConfig);
      expect(config).toEqual(expectedConfig);
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

      const config = await loadConfig('http://localhost:8080/remote-config');
      expect(config).toEqual(expectedConfig);
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
        headers: {
          Authorization: 'Bearer global-token',
        },
        requests: [
          {
            url: 'http://localhost:8080/test',
            method: 'GET' as const,
            headers: {
              'X-Request-ID': '123',
            },
          },
        ],
      };

      const parsedConfig = await loadConfig(configWithHeaders);

      expect(parsedConfig.requests[0].headers).toEqual({
        'X-Request-ID': '123',
      });
      expect(parsedConfig.headers).toEqual({
        Authorization: 'Bearer global-token',
      });
    });

    /**
     * Configuration Loading Tests - Files and URLs
     */
    describe('Configuration Loading Tests', () => {
      it('should load config from local file', async () => {
        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), 'tressi-test-'),
        );
        const configPath = path.join(tempDir, 'test-config.json');

        const testConfig = {
          requests: [
            { url: 'http://localhost:8080/file-test', method: 'POST' as const },
          ],
          workers: 5,
          duration: 30,
        };

        await fs.writeFile(configPath, JSON.stringify(testConfig));

        const config = await loadConfig(configPath);
        expect(config.requests).toHaveLength(1);
        expect(config.requests[0].url).toBe('http://localhost:8080/file-test');
        expect(config.requests[0].method).toBe('POST');
        expect(config.workers).toBe(5);
        expect(config.duration).toBe(30);

        await fs.unlink(configPath);
        await fs.rmdir(tempDir);
      });

      it('should load config from HTTPS URL', async () => {
        const mockPool = mockAgent.get('https://api.example.com');
        const httpsConfig = {
          requests: [
            { url: 'https://api.example.com/test', method: 'GET' as const },
          ],
          headers: { Authorization: 'Bearer token123' },
        };

        mockPool
          .intercept({ path: '/config.json', method: 'GET' })
          .reply(200, httpsConfig);

        const config = await loadConfig('https://api.example.com/config.json');
        expect(config.requests).toHaveLength(1);
        expect(config.headers).toEqual({ Authorization: 'Bearer token123' });
      });

      it('should handle URL with query parameters', async () => {
        const mockPool = mockAgent.get('http://config.service.com');
        const configWithQuery = {
          requests: [{ url: 'http://test.com/api', method: 'PUT' as const }],
          rps: 100,
        };

        mockPool
          .intercept({ path: '/config?version=latest&env=prod', method: 'GET' })
          .reply(200, configWithQuery);

        const config = await loadConfig(
          'http://config.service.com/config?version=latest&env=prod',
        );
        expect(config.rps).toBe(100);
      });

      it('should handle network timeout gracefully', async () => {
        const mockPool = mockAgent.get('http://timeout.com');

        mockPool
          .intercept({ path: '/slow-config', method: 'GET' })
          .reply(200, minimalConfig)
          .delay(100); // Simulate slow response

        // This should still work as undici handles timeouts differently
        const config = await loadConfig('http://timeout.com/slow-config');
        expect(config).toEqual(expectedConfig);
      });
    });

    /**
     * Validation Tests - Complex Configuration Scenarios
     */
    describe('Validation Tests - Complex Configuration', () => {
      it('should validate complex configuration with all properties', async () => {
        const complexConfig = {
          $schema: 'https://example.com/schema.json',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
          },
          requests: [
            {
              url: 'https://api.example.com/users',
              method: 'GET' as const,
              headers: { 'X-API-Version': 'v1' },
            },
            {
              url: 'https://api.example.com/users',
              method: 'POST' as const,
              payload: { name: 'John', email: 'john@example.com' },
            },
          ],
          workers: 20,
          concurrentRequests: 10,
          duration: 300,
          rampUpTime: 30,
          rps: 500,
          autoscale: true,
          export: './reports/load-test',
          earlyExitOnError: true,
          errorRateThreshold: 0.1,
          errorCountThreshold: 50,
          errorStatusCodes: [400, 401, 403, 404, 500, 502, 503],
        };

        const result = await loadConfig(complexConfig);
        expect(result).toMatchObject(complexConfig);
      });
    });

    /**
     * Error Handling Tests - Core Scenarios
     */
    describe('Error Handling Tests', () => {
      it('should throw error for invalid JSON file', async () => {
        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), 'tressi-test-'),
        );
        const configPath = path.join(tempDir, 'invalid.json');

        await fs.writeFile(configPath, '{ invalid json }');

        await expect(loadConfig(configPath)).rejects.toThrow();

        await fs.unlink(configPath);
        await fs.rmdir(tempDir);
      });

      it('should throw error for non-existent file', async () => {
        const nonExistentPath = path.join(
          os.tmpdir(),
          'non-existent-config.json',
        );
        await expect(loadConfig(nonExistentPath)).rejects.toThrow();
      });

      it('should throw error for missing required requests property', async () => {
        const invalidConfig = {
          workers: 10,
          duration: 60,
        } as unknown as TressiConfig;

        await expect(loadConfig(invalidConfig)).rejects.toThrow();
      });

      it('should throw error for empty requests array', async () => {
        const invalidConfig = {
          requests: [],
        };

        await expect(loadConfig(invalidConfig)).rejects.toThrow();
      });
    });
  });

  /**
   * Schema validation tests
   */
  describe('TressiConfigSchema', () => {
    it('should parse valid configuration', () => {
      const validConfig = {
        requests: [{ url: 'http://test.com', method: 'GET' }],
        workers: 10,
        duration: 60,
      };

      const result = TressiConfigSchema.parse(validConfig);
      expect(result.workers).toBe(10);
    });

    it('should strip unknown properties', () => {
      const configWithUnknown = {
        requests: [{ url: 'http://test.com', method: 'GET' }],
        workers: 10,
        unknownProperty: 'should-be-stripped',
      };

      const result = TressiConfigSchema.parse(configWithUnknown);
      expect(
        (result as Record<string, unknown>).unknownProperty,
      ).toBeUndefined();
    });
  });
});
