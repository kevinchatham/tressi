import type { TestDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { metricStorage } from '../../collections/metrics-collection';
import { testStorage } from '../../collections/test-collection';
import app from './test-routes';

vi.mock('../../collections/test-collection', () => ({
  testStorage: {
    create: vi.fn(),
    delete: vi.fn(),
    edit: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../../collections/config-collection', () => ({
  configStorage: {
    getById: vi.fn(),
  },
}));

vi.mock('../../collections/metrics-collection', () => ({
  metricStorage: {
    deleteByTestId: vi.fn(),
  },
}));

vi.mock('../../core/test-executor', () => ({
  runLoadTestForServer: vi.fn(),
  stopLoadTest: vi.fn(),
}));

vi.mock('../utils/error-response-generator', () => ({
  createApiErrorResponse: vi.fn((message, code) => ({ code, message })),
}));

describe('test-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / should return all tests', async () => {
    const mockTests = [{ id: '1', status: 'completed' }];
    vi.mocked(testStorage.getAll).mockResolvedValue(mockTests as unknown as TestDocument[]);

    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockTests);
  });

  it('GET /:id should return a test', async () => {
    const mockTest = { id: '1', status: 'completed' };
    vi.mocked(testStorage.getById).mockResolvedValue(mockTest as unknown as TestDocument);

    const res = await app.request('/1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockTest);
  });

  it('DELETE /:id should delete a test', async () => {
    vi.mocked(testStorage.getById).mockResolvedValue({
      id: '1',
    } as unknown as TestDocument);
    vi.mocked(testStorage.delete).mockResolvedValue(true);
    vi.mocked(metricStorage.deleteByTestId).mockResolvedValue(1);

    const res = await app.request('/1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ metricsDeleted: 1, success: true });
  });
});
