import { ConfigDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configStorage } from '../../collections/config-collection';
import app from './config-routes';

vi.mock('../../collections/config-collection', () => ({
  configStorage: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../utils/error-response-generator', () => ({
  createApiErrorResponse: vi.fn((message, code) => ({ message, code })),
}));

describe('config-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / should return all configs', async () => {
    const mockConfigs = [{ id: '1', name: 'test' }];
    vi.mocked(configStorage.getAll).mockResolvedValue(
      mockConfigs as unknown as ConfigDocument[],
    );

    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockConfigs);
  });

  it('GET /:id should return a config', async () => {
    const mockConfig = { id: '1', name: 'test' };
    vi.mocked(configStorage.getById).mockResolvedValue(
      mockConfig as unknown as ConfigDocument,
    );

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
      id: '1',
      name: 'test',
      config: { duration: 10, rps: 10, target: 'http://localhost' },
    };
    vi.mocked(configStorage.create).mockResolvedValue(
      mockConfig as unknown as ConfigDocument,
    );

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test',
        config: {
          $schema: 'test',
          requests: [
            {
              method: 'GET',
              url: 'http://localhost',
              payload: {},
              headers: {},
              rps: 10,
              rampUpDurationSec: 1,
            },
          ],
          duration: 10,
          rps: 10,
          target: 'http://localhost',
        },
      }),
      headers: { 'Content-Type': 'application/json' },
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
