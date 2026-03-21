import type { MetricCreate, TestSummary } from '@tressi/shared/common';
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

  it('should get a metric by id', async () => {
    const mockRow = {
      epoch: 123,
      id: '1',
      metric: JSON.stringify({ global: { averageRequestsPerSecond: 1 } }),
      test_id: '1',
    };
    const mockBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue(mockRow),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const metric = await metricStorage.getById('1');
    expect(metric).toBeDefined();
    expect(metric?.id).toBe('1');
  });

  it('should return undefined when metric not found by id', async () => {
    const mockBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const metric = await metricStorage.getById('non-existent');
    expect(metric).toBeUndefined();
  });

  it('should get metrics by test id', async () => {
    const mockRows = [
      {
        epoch: 123,
        id: '1',
        metric: JSON.stringify({ global: { averageRequestsPerSecond: 1 } }),
        test_id: 'test-1',
      },
      {
        epoch: 124,
        id: '2',
        metric: JSON.stringify({ global: { averageRequestsPerSecond: 2 } }),
        test_id: 'test-1',
      },
    ];
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue(mockRows),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const metrics = await metricStorage.getByTestId('test-1');
    expect(metrics).toHaveLength(2);
    expect(metrics[0].testId).toBe('test-1');
  });

  it('should create a batch of metrics', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue({}),
      values: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const inputs: MetricCreate[] = [
      {
        epoch: 123,
        metric: { global: { averageRequestsPerSecond: 1 } } as TestSummary,
        testId: '1',
      },
      {
        epoch: 124,
        metric: { global: { averageRequestsPerSecond: 2 } } as TestSummary,
        testId: '1',
      },
    ];
    const metrics = await metricStorage.createBatch(inputs);
    expect(metrics).toHaveLength(2);
    expect(metrics[0].testId).toBe('1');
    expect(metrics[1].testId).toBe('1');
  });

  it('should return empty array when creating batch with no inputs', async () => {
    const metrics = await metricStorage.createBatch([]);
    expect(metrics).toEqual([]);
  });

  it('should return false when deleting non-existent metric', async () => {
    const mockBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const result = await metricStorage.delete('non-existent');
    expect(result).toBe(false);
  });

  it('should delete metrics by test id', async () => {
    const deleteBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 3n }),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.deleteFrom).mockReturnValue(
      deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
    );

    const result = await metricStorage.deleteByTestId('test-1');
    expect(result).toBe(3);
  });

  describe('error handling', () => {
    it('should throw error when getAll fails', async () => {
      const mockBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        selectAll: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      await expect(metricStorage.getAll()).rejects.toThrow(
        'Failed to retrieve metrics: Database error',
      );
    });

    it('should throw error when getById fails', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error')),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      await expect(metricStorage.getById('1')).rejects.toThrow(
        'Failed to retrieve metric: Database error',
      );
    });

    it('should throw error when getByTestId fails', async () => {
      const mockBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      await expect(metricStorage.getByTestId('test-1')).rejects.toThrow(
        'Failed to retrieve metrics for test: Database error',
      );
    });

    it('should throw error when create fails', async () => {
      const mockBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        values: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.insertInto).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.insertInto>,
      );

      const input: MetricCreate = {
        epoch: 123,
        metric: { global: { averageRequestsPerSecond: 1 } } as TestSummary,
        testId: '1',
      };
      await expect(metricStorage.create(input)).rejects.toThrow(
        'Failed to create metric: Database error',
      );
    });

    it('should throw error when createBatch fails', async () => {
      const mockBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        values: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.insertInto).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.insertInto>,
      );

      const inputs: MetricCreate[] = [
        {
          epoch: 123,
          metric: { global: { averageRequestsPerSecond: 1 } } as TestSummary,
          testId: '1',
        },
      ];
      await expect(metricStorage.createBatch(inputs)).rejects.toThrow(
        'Failed to create metrics batch: Database error',
      );
    });

    it('should throw error when delete fails', async () => {
      const selectBuilder = {
        executeTakeFirst: vi.fn().mockResolvedValue({
          epoch: 123,
          id: '1',
          metric: JSON.stringify({ global: {} }),
          test_id: '1',
        }),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        selectBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      const deleteBuilder = {
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error')),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.deleteFrom).mockReturnValue(
        deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
      );

      await expect(metricStorage.delete('1')).rejects.toThrow(
        'Failed to delete metric: Database error',
      );
    });

    it('should throw error when deleteByTestId fails', async () => {
      const deleteBuilder = {
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error')),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.deleteFrom).mockReturnValue(
        deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
      );

      await expect(metricStorage.deleteByTestId('test-1')).rejects.toThrow(
        'Failed to delete metrics for test: Database error',
      );
    });
  });
});
