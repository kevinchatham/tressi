import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TestDocument, TestMetrics, TestStatus } from '@tressi/shared/common';
import { TestDetailResolvedData } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestService } from '../services/test.service';
import { testDetailResolver } from './test-detail.resolver';

describe('testDetailResolver', () => {
  let testServiceSpy: {
    getTestById: ReturnType<typeof vi.fn>;
    getTestMetrics: ReturnType<typeof vi.fn>;
  };
  let mockRoute: ActivatedRouteSnapshot;

  beforeEach(() => {
    testServiceSpy = {
      getTestById: vi.fn(),
      getTestMetrics: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: TestService, useValue: testServiceSpy }],
    });

    mockRoute = {
      paramMap: {
        get: vi.fn() as () => string | null,
      },
    } as unknown as ActivatedRouteSnapshot;
  });

  it('should resolve test details and metrics when testId is provided', async () => {
    const mockState = {} as RouterStateSnapshot;
    const testId = 'test123';

    const mockTest = {
      id: testId,
      configId: 'config1',
      name: 'Test Run',
      status: 'completed' as TestStatus,
      epochCreatedAt: Date.now(),
      error: null,
      summary: {
        global: {
          epochStartedAt: Date.now() - 10000,
          epochEndedAt: Date.now(),
        },
      },
    } as unknown as TestDocument;

    const mockMetrics: TestMetrics = {
      global: [],
      endpoints: [],
    };

    // Mock the paramMap.get to return the testId
    (mockRoute.paramMap.get as () => string | null) = vi.fn(() => testId);

    testServiceSpy.getTestById.mockResolvedValue(mockTest);
    testServiceSpy.getTestMetrics.mockResolvedValue(mockMetrics);

    const resolved = (await TestBed.runInInjectionContext(() =>
      testDetailResolver(mockRoute, mockState),
    )) as TestDetailResolvedData;

    expect(resolved.test).toEqual(mockTest);
    expect(resolved.metrics).toEqual(mockMetrics);
    expect(testServiceSpy.getTestById).toHaveBeenCalledWith(testId);
    expect(testServiceSpy.getTestMetrics).toHaveBeenCalledWith(testId);
  });

  it('should throw error when testId is missing', async () => {
    const mockState = {} as RouterStateSnapshot;

    (mockRoute.paramMap.get as () => string | null) = vi.fn(() => null);

    await expect(
      TestBed.runInInjectionContext(() =>
        testDetailResolver(mockRoute, mockState),
      ),
    ).rejects.toThrow('Test ID is required for resolution');
  });
});
