import type { ConfigDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configStorage } from '../../collections/config-collection';
import app from './config-routes';

vi.mock('../../collections/config-collection', () => ({
  configStorage: {
    create: vi.fn(),
    delete: vi.fn(),
    edit: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../utils/error-response-generator', () => ({
  createApiErrorResponse: vi.fn((message, code) => ({ code, message })),
}));

describe('config-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / should return all configs', async () => {
    const mockConfigs = [{ id: '1', name: 'test' }];
    vi.mocked(configStorage.getAll).mockResolvedValue(mockConfigs as unknown as ConfigDocument[]);

    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockConfigs);
  });

  it('GET /:id should return a config', async () => {
    const mockConfig = { id: '1', name: 'test' };
    vi.mocked(configStorage.getById).mockResolvedValue(mockConfig as unknown as ConfigDocument);

    const res = await app.request('/1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockConfig);
  });

  it('GET /:id should return 404 if not found', async () => {
    vi.mocked(configStorage.getById).mockResolvedValue(undefined);

    const res = await app.request('/1');
    expect(res.status).toBe(404);
  });

  it('POST / should create a config', async () => {
    const mockConfig = {
      config: { duration: 10, rps: 10, target: 'http://localhost' },
      id: '1',
      name: 'test',
    };
    vi.mocked(configStorage.create).mockResolvedValue(mockConfig as unknown as ConfigDocument);

    const res = await app.request('/', {
      body: JSON.stringify({
        config: {
          $schema: 'test',
          duration: 10,
          requests: [
            {
              headers: {},
              method: 'GET',
              payload: {},
              rampUpDurationSec: 1,
              rps: 10,
              url: 'http://localhost',
            },
          ],
          rps: 10,
          target: 'http://localhost',
        },
        name: 'test',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(res.status).toBe(201);
  });

  it('DELETE /:id should delete a config', async () => {
    vi.mocked(configStorage.delete).mockResolvedValue(true);

    const res = await app.request('/1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
