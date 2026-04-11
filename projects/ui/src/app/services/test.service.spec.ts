import { TestBed } from '@angular/core/testing';
import type { DeleteTestResponse, MetricDocument, TestDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LogService } from './log.service';
import { RPCService } from './rpc.service';
import { TestService } from './test.service';

describe('TestService', () => {
  let service: TestService;

  let mockRPC: {
    client: {
      tests: {
        $get: Mock;
        ':id': {
          $get: Mock;
          $delete: Mock;
        };
      };
      metrics: {
        ':testId': { $get: Mock };
      };
    };
  };

  let mockLog: {
    error: Mock;
  };

  beforeEach(() => {
    const mockTestsClient = {
      ':id': {
        $delete: vi.fn(),
        $get: vi.fn(),
      },
      $get: vi.fn(),
    };

    mockRPC = {
      client: {
        metrics: {
          ':testId': { $get: vi.fn() },
        },
        tests: mockTestsClient,
      },
    } as unknown as typeof mockRPC;

    mockLog = {
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TestService,
        { provide: RPCService, useValue: mockRPC },
        { provide: LogService, useValue: mockLog },
      ],
    });

    service = TestBed.inject(TestService);
  });

  describe('getTestsByConfigId', () => {
    it('should filter and sort tests by configId and creation date', async () => {
      const mockTests: Partial<TestDocument>[] = [
        { configId: 'config-A', epochCreatedAt: 1000, id: '1' },
        { configId: 'config-A', epochCreatedAt: 3000, id: '2' },
        { configId: 'config-B', epochCreatedAt: 2000, id: '3' },
      ];

      mockRPC.client.tests.$get.mockResolvedValue({
        json: async () => mockTests,
        ok: true,
      });

      const result = await service.getTestsByConfigId('config-A');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });

    it('should throw error when response is not ok', async () => {
      mockRPC.client.tests.$get.mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      await expect(service.getTestsByConfigId('config-A')).rejects.toThrow(
        'Failed to load tests: Server Error',
      );
    });

    it('should log error when request fails', async () => {
      const error = new Error('Network error');
      mockRPC.client.tests.$get.mockRejectedValue(error);

      await expect(service.getTestsByConfigId('config-A')).rejects.toThrow();
      expect(mockLog.error).toHaveBeenCalledWith('Failed to load tests:', error);
    });
  });

  describe('getTestById', () => {
    it('should return test document when response is ok', async () => {
      const mockTest: Partial<TestDocument> = { configId: 'config-A', id: 'test-1' };

      mockRPC.client.tests[':id'].$get.mockResolvedValue({
        json: async () => mockTest,
        ok: true,
      });

      const result = await service.getTestById('test-1');

      expect(result).toEqual(mockTest);
      expect(mockRPC.client.tests[':id'].$get).toHaveBeenCalledWith({
        param: { id: 'test-1' },
      });
    });

    it('should throw error when response is not ok', async () => {
      mockRPC.client.tests[':id'].$get.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.getTestById('test-1')).rejects.toThrow('Failed to load test: Not Found');
    });

    it('should log error when request fails', async () => {
      const error = new Error('Network error');
      mockRPC.client.tests[':id'].$get.mockRejectedValue(error);

      await expect(service.getTestById('test-1')).rejects.toThrow();
      expect(mockLog.error).toHaveBeenCalledWith('Failed to load test:', error);
    });
  });

  describe('deleteTest', () => {
    it('should return delete response when successful', async () => {
      const mockResponse: DeleteTestResponse = {
        metricsDeleted: 1,
        success: true,
      };

      mockRPC.client.tests[':id'].$delete.mockResolvedValue({
        json: async () => mockResponse,
        ok: true,
      });

      const result = await service.deleteTest('test-1');

      expect(result).toEqual(mockResponse);
      expect(mockRPC.client.tests[':id'].$delete).toHaveBeenCalledWith({
        param: { id: 'test-1' },
      });
    });

    it('should throw error when response is not ok', async () => {
      mockRPC.client.tests[':id'].$delete.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
      });

      await expect(service.deleteTest('test-1')).rejects.toThrow('Failed to delete test: Conflict');
    });

    it('should log error when request fails', async () => {
      const error = new Error('Network error');
      mockRPC.client.tests[':id'].$delete.mockRejectedValue(error);

      await expect(service.deleteTest('test-1')).rejects.toThrow();
      expect(mockLog.error).toHaveBeenCalledWith('Failed to delete test:', error);
    });
  });

  describe('getTestMetrics', () => {
    it('should return metrics array when successful', async () => {
      const mockMetrics: MetricDocument[] = [
        { epoch: 1000, id: 'metric-1', metric: {}, testId: 'test-1' } as unknown as MetricDocument,
      ];

      mockRPC.client.metrics[':testId'].$get.mockResolvedValue({
        json: async () => mockMetrics,
        ok: true,
      });

      const result = await service.getTestMetrics('test-1');

      expect(result).toEqual(mockMetrics);
      expect(mockRPC.client.metrics[':testId'].$get).toHaveBeenCalledWith({
        param: { testId: 'test-1' },
      });
    });

    it('should throw error when response is not ok', async () => {
      mockRPC.client.metrics[':testId'].$get.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.getTestMetrics('test-1')).rejects.toThrow(
        'Failed to load metrics: Not Found',
      );
    });

    it('should log error when request fails', async () => {
      const error = new Error('Network error');
      mockRPC.client.metrics[':testId'].$get.mockRejectedValue(error);

      await expect(service.getTestMetrics('test-1')).rejects.toThrow();
      expect(mockLog.error).toHaveBeenCalledWith('Failed to load test metrics:', error);
    });
  });

  describe('getTestDuration', () => {
    it('should calculate duration correctly for completed tests', () => {
      const mockTest = {
        summary: {
          global: {
            epochEndedAt: 5000,
            epochStartedAt: 1000,
          },
        },
      } as TestDocument;

      const duration = service.getTestDuration(mockTest);
      expect(duration).toBe(4000);
    });

    it('should use current time when test has not ended', () => {
      const before = Date.now();
      const mockTest = {
        summary: {
          global: {
            epochStartedAt: before - 1000,
          },
        },
      } as TestDocument;

      const duration = service.getTestDuration(mockTest);
      expect(duration).toBeGreaterThanOrEqual(999);
      expect(duration).toBeLessThanOrEqual(Date.now() - before + 1000);
    });

    it('should return 0 if test has not started', () => {
      const mockTest = {
        summary: {
          global: { epochStartedAt: undefined },
        },
      } as unknown as TestDocument;

      expect(service.getTestDuration(mockTest)).toBe(0);
    });
  });
});
