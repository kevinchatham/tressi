import { Metric } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { metricStorage } from './metrics-collection';

vi.mock('../data/database', () => {
  const mockDb = {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
  };
  return { db: mockDb };
});

describe('MetricCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all metrics', async () => {
    const mockBuilder = {
      selectAll: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const metrics = await metricStorage.getAll();
    expect(metrics).toEqual([]);
  });

  it('should create a metric', async () => {
    const mockBuilder = {
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const metric = await metricStorage.create({
      testId: '1',
      url: 'test',
      metric: {
        failedRequests: 0,
        maxLatencyMs: 100,
        minLatencyMs: 10,
        networkBytesReceived: 0,
        networkBytesSent: 0,
        networkBytesPerSec: 0,
        p50LatencyMs: 50,
        p95LatencyMs: 95,
        p99LatencyMs: 99,
        averageRequestsPerSecond: 1,
        peakRequestsPerSecond: 1,
        errorRate: 0,
        statusCodeDistribution: {},
        successfulRequests: 1,
        totalRequests: 1,
        targetAchieved: 1,
      } as unknown as Metric,
      epoch: 123,
    });
    expect(metric.testId).toBe('1');
  });

  it('should delete a metric', async () => {
    const mockBuilder = {
      where: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: '1',
        test_id: '1',
        url: 'test',
        metric: JSON.stringify({
          failedRequests: 0,
          maxLatencyMs: 100,
          minLatencyMs: 10,
          networkBytesReceived: 0,
          networkBytesSent: 0,
          networkBytesPerSec: 0,
          p50LatencyMs: 50,
          p95LatencyMs: 95,
          p99LatencyMs: 99,
          averageRequestsPerSecond: 1,
          peakRequestsPerSecond: 1,
          errorRate: 0,
          statusCodeDistribution: {},
          successfulRequests: 1,
          totalRequests: 1,
          targetAchieved: 1,
        }),
        epoch: 123,
      }),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const deleteBuilder = {
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
    };
    vi.mocked(db.deleteFrom).mockReturnValue(
      deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
    );

    const result = await metricStorage.delete('1');
    expect(result).toBe(true);
  });
});
