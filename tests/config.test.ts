import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll,afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig, TressiConfig } from '../src/config';

const validConfig: TressiConfig = {
  requests: [{ url: 'http://localhost:8080/test' }],
};

const server = setupServer(
  http.get('http://localhost:8080/remote-config', () => {
    return HttpResponse.json(validConfig);
  }),
  http.get('http://localhost:8080/remote-config-failing', () => {
    return new HttpResponse(null, { status: 500 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('config', () => {
  describe('loadConfig', () => {
    it('should load config from a direct object', async () => {
      const config = await loadConfig(validConfig);
      expect(config).toEqual(validConfig);
    });

    it('should load config from a remote URL', async () => {
      const config = await loadConfig('http://localhost:8080/remote-config');
      expect(config).toEqual(validConfig);
    });

    it('should throw an error for a failing remote URL', async () => {
      await expect(
        loadConfig('http://localhost:8080/remote-config-failing'),
      ).rejects.toThrow('Remote config fetch failed: 500');
    });

    it('should throw ZodError for an invalid config object', async () => {
        const invalidConfig = { requests: [{ url: 'invalid-url' }] };
        await expect(loadConfig(invalidConfig)).rejects.toThrow();
    });
  });
}); 