import { TestBed } from '@angular/core/testing';
import type { TestDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LogService } from './log.service';
import { RPCService } from './rpc.service';
import { TestService } from './test.service';

describe('TestService', () => {
  let service: TestService;

  // Use Partial and Mock types instead of any
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
    } as unknown as typeof mockRPC; // Cast to our mock structure

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
      // Use Partial<TestDocument> for type safety without defining every field
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
      } as TestDocument; // Cast to the actual interface

      const duration = service.getTestDuration(mockTest);
      expect(duration).toBe(4000);
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
