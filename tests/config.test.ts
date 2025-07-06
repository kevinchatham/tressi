import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig, TressiConfig } from '../src/config';

const minimalConfig = {
  requests: [{ url: 'http://localhost:8080/test' }],
};

const expectedConfig: TressiConfig = {
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' }],
};

const server = setupServer(
  http.get('http://localhost:8080/remote-config', () => {
    return HttpResponse.json(minimalConfig);
  }),
  http.get('http://localhost:8080/remote-config-failing', () => {
    return new HttpResponse(null, { status: 500 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
      const config = await loadConfig('http://localhost:8080/remote-config');
      expect(config).toEqual(expectedConfig);
    });

    /**
     * It should throw a specific error if the remote URL fetch fails
     * (e.g., returns a non-2xx status code).
     */
    it('should throw an error for a failing remote URL', async () => {
      await expect(
        loadConfig('http://localhost:8080/remote-config-failing'),
      ).rejects.toThrow('Remote config fetch failed: 500');
    });

    /**
     * It should throw a Zod validation error if the provided config
     * object does not match the TressiConfigSchema.
     */
    it('should throw ZodError for an invalid config object', async () => {
      const invalidConfig = { requests: [{ url: 'invalid-url' }] };
      await expect(loadConfig(invalidConfig)).rejects.toThrow();
    });
  });
});
