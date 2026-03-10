import { ISSEClientManager } from '@tressi/shared/cli';
import { MetricDocument } from '@tressi/shared/common';
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
    removeClient: vi.fn(),
    broadcast: vi.fn(),
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
});
