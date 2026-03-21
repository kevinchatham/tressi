import type { ISSEClientManager } from '@tressi/shared/cli';
import type { MetricDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { metricStorage } from '../../collections/metrics-collection';
import createMetricsApp from './metrics-routes';

vi.mock('../../collections/metrics-collection', () => ({
  metricStorage: {
    getByTestId: vi.fn(),
  },
}));

describe('metrics-routes', () => {
  const mockSseManager = {
    addClient: vi.fn(),
    broadcast: vi.fn(),
    removeClient: vi.fn(),
  } as unknown as ISSEClientManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /system should return system info', async () => {
    const app = createMetricsApp(mockSseManager);
    const res = await app.request('/system');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('cpuCount');
    expect(data).toHaveProperty('nodeVersion');
  });

  it('GET /:testId should return metrics', async () => {
    const mockMetrics = [{ id: '1', testId: 'test-1' }];
    vi.mocked(metricStorage.getByTestId).mockResolvedValue(
      mockMetrics as unknown as MetricDocument[],
    );

    const app = createMetricsApp(mockSseManager);
    const res = await app.request('/test-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockMetrics);
  });

  it('GET /:testId should return error response when storage throws', async () => {
    vi.mocked(metricStorage.getByTestId).mockRejectedValue(new Error('Database connection failed'));

    const app = createMetricsApp(mockSseManager);
    const res = await app.request('/test-1');
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.message).toBe('Failed to load metrics');
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.details).toContain('Database connection failed');
  });
});
