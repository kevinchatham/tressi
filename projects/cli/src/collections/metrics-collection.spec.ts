import type { TestSummary } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { metricStorage } from './metrics-collection';

vi.mock('../data/database', () => {
  const mockDb = {
    deleteFrom: vi.fn(),
    insertInto: vi.fn(),
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
  };
  return { db: mockDb };
});

describe('MetricCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all metrics', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue([]),
      selectAll: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const metrics = await metricStorage.getAll();
    expect(metrics).toEqual([]);
  });

  it('should create a metric', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue({}),
      values: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const metric = await metricStorage.create({
      epoch: 123,
      metric: {
        global: {
          averageRequestsPerSecond: 1,
          errorRate: 0,
          failedRequests: 0,
          maxLatencyMs: 100,
          minLatencyMs: 10,
          networkBytesPerSec: 0,
          networkBytesReceived: 0,
          networkBytesSent: 0,
          p50LatencyMs: 50,
          p95LatencyMs: 95,
          p99LatencyMs: 99,
          peakRequestsPerSecond: 1,
          statusCodeDistribution: {},
          successfulRequests: 1,
          targetAchieved: 1,
          totalRequests: 1,
        },
      } as unknown as TestSummary,
      testId: '1',
    });
    expect(metric.testId).toBe('1');
  });

  it('should delete a metric', async () => {
    const mockBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue({
        epoch: 123,
        id: '1',
        metric: JSON.stringify({
          averageRequestsPerSecond: 1,
          errorRate: 0,
          failedRequests: 0,
          maxLatencyMs: 100,
          minLatencyMs: 10,
          networkBytesPerSec: 0,
          networkBytesReceived: 0,
          networkBytesSent: 0,
          p50LatencyMs: 50,
          p95LatencyMs: 95,
          p99LatencyMs: 99,
          peakRequestsPerSecond: 1,
          statusCodeDistribution: {},
          successfulRequests: 1,
          targetAchieved: 1,
          totalRequests: 1,
        }),
        test_id: '1',
        url: 'test',
      }),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const deleteBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.deleteFrom).mockReturnValue(
      deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
    );

    const result = await metricStorage.delete('1');
    expect(result).toBe(true);
  });
});
