import { describe, expect, it } from 'vitest';

import { loadConfig, TressiConfig } from '../src/config';
import { createMockAgent } from './setupTests';

const minimalConfig = {
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' as const }],
};

const expectedConfig: TressiConfig = {
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' }],
};

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
      const mockAgent = createMockAgent();
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
      const mockAgent = createMockAgent();
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
  });
});
