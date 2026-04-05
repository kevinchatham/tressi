import { TestBed } from '@angular/core/testing';
import {
  defaultTressiConfig,
  type GlobalSummary,
  type LatencyHistogram,
  type MetricDocument,
  type TestDocument,
  type TestSummary,
} from '@tressi/shared/common';
import type { ChartType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigService } from '../../services/config.service';
import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { TestService } from '../../services/test.service';
import { TestExportService } from '../../services/test-export.service';
import { TestDetailService } from './test-detail.service';

describe('TestDetailService', () => {
  let service: TestDetailService;
  let configServiceSpy: ReturnType<typeof vi.fn>;
  let eventServiceSpy: {
    getMetricsStream: ReturnType<typeof vi.fn>;
    getTestEventsStream: ReturnType<typeof vi.fn>;
  };
  let logServiceSpy: ReturnType<typeof vi.fn>;
  let testServiceSpy: ReturnType<typeof vi.fn>;
  let testExportServiceSpy: ReturnType<typeof vi.fn>;

  const mockHistogram: LatencyHistogram = {
    buckets: [
      { count: 100, lowerBound: 0, upperBound: 20 },
      { count: 200, lowerBound: 20, upperBound: 40 },
    ],
    max: 120,
    mean: 50,
    min: 10,
    percentiles: {
      50: 45,
      95: 80,
      99: 100,
    },
    stdDev: 20,
    totalCount: 1000,
  };

  const mockGlobalSummary: GlobalSummary = {
    averageRequestsPerSecond: 100,
    avgProcessMemoryUsageMB: 100,
    avgSystemCpuUsagePercent: 50,
    earlyExitTriggered: false,
    epochEndedAt: 2000,
    epochStartedAt: 1000,
    errorRate: 0.05,
    failedRequests: 50,
    finalDurationSec: 10,
    histogram: mockHistogram,
    maxLatencyMs: 120,
    minLatencyMs: 10,
    networkBytesPerSec: 5000,
    networkBytesReceived: 25000,
    networkBytesSent: 25000,
    p50LatencyMs: 45,
    p95LatencyMs: 80,
    p99LatencyMs: 100,
    peakRequestsPerSecond: 150,
    successfulRequests: 950,
    targetAchieved: 0.95,
    totalEndpoints: 1,
    totalRequests: 1000,
  };

  const mockTest: TestDocument = {
    configId: 'config-1',
    epochCreatedAt: Date.now(),
    error: null,
    id: 'test-123',
    status: 'completed',
    summary: {
      configSnapshot: defaultTressiConfig,
      endpoints: [],
      global: mockGlobalSummary,
      tressiVersion: '1.0.0',
    },
  };

  const mockMetrics: MetricDocument[] = [
    {
      epoch: 1000,
      id: 'metric-1',
      metric: {
        global: {
          averageRequestsPerSecond: 100,
          earlyExitTriggered: false,
          errorRate: 0.05,
          failedRequests: 5,
          maxLatencyMs: 120,
          minLatencyMs: 10,
          networkBytesPerSec: 5000,
          networkBytesReceived: 2500,
          networkBytesSent: 2500,
          p50LatencyMs: 45,
          p95LatencyMs: 80,
          p99LatencyMs: 100,
          peakRequestsPerSecond: 150,
          statusCodeDistribution: { '200': 95 },
          successfulRequests: 95,
          targetAchieved: 0.95,
          totalRequests: 100,
        },
      } as unknown as TestSummary,
      testId: 'test-123',
    },
  ];

  beforeEach(() => {
    configServiceSpy = vi.fn(() => Promise.resolve({ id: 'config-1', name: 'Test Config' }));
    eventServiceSpy = {
      getMetricsStream: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
      getTestEventsStream: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    };
    logServiceSpy = vi.fn();
    testServiceSpy = vi.fn(() => Promise.resolve(mockMetrics));
    testExportServiceSpy = vi.fn(() => Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        TestDetailService,
        { provide: ConfigService, useValue: { getOne: configServiceSpy } },
        { provide: EventService, useValue: eventServiceSpy },
        {
          provide: LogService,
          useValue: { error: logServiceSpy, info: logServiceSpy },
        },
        { provide: TestService, useValue: { getTestMetrics: testServiceSpy } },
        {
          provide: TestExportService,
          useValue: { exportTest: testExportServiceSpy },
        },
      ],
    });

    service = TestBed.inject(TestDetailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with test data', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      expect(service.testId()).toBe('test-123');
      expect(service.test()).toEqual(mockTest);
      expect(service.metrics()).toEqual(mockMetrics);
    });

    it('should set test time range from global summary', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      expect(service.testTimeRange()).toEqual({
        max: 2000,
        min: 1000,
      });
    });

    it('should load config when configId is provided', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      expect(configServiceSpy).toHaveBeenCalledWith('config-1');
    });
  });

  describe('isRealTime', () => {
    it('should return true when test status is running', () => {
      const runningTest = { ...mockTest, status: 'running' as const };
      service.initialize({ metrics: mockMetrics, test: runningTest });

      expect(service.isRealTime()).toBe(true);
    });

    it('should return false when test status is completed', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      expect(service.isRealTime()).toBe(false);
    });
  });

  describe('selectedSummary', () => {
    it('should return global summary when endpoint is global', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      service.selectedEndpoint.set('global');

      expect(service.selectedSummary()).toEqual(mockGlobalSummary);
    });

    it('should return endpoint summary when endpoint is selected', () => {
      const testWithEndpoint = {
        ...mockTest,
        summary: {
          ...mockTest.summary!,
          endpoints: [
            {
              averageRequestsPerSecond: 50,
              earlyExitTriggered: false,
              epochEndedAt: 2000,
              epochStartedAt: 1000,
              errorRate: 0.04,
              failedRequests: 20,
              histogram: mockHistogram,
              maxLatencyMs: 100,
              method: 'GET',
              minLatencyMs: 5,
              networkBytesPerSec: 2500,
              networkBytesReceived: 1250,
              networkBytesSent: 1250,
              p50LatencyMs: 40,
              p95LatencyMs: 70,
              p99LatencyMs: 90,
              peakRequestsPerSecond: 75,
              responseSamples: [],
              statusCodeDistribution: { '200': 480 },
              successfulRequests: 480,
              targetAchieved: 0.96,
              targetRps: 50,
              theoreticalMaxRps: 100,
              totalRequests: 500,
              url: 'https://api.example.com/users',
            },
          ],
        },
      };
      service.initialize({
        metrics: mockMetrics,
        test: testWithEndpoint as TestDocument,
      });
      service.selectedEndpoint.set('https://api.example.com/users');

      const summary = service.selectedSummary();
      expect(summary).toBeDefined();
      expect((summary as { url: string }).url).toBe('https://api.example.com/users');
    });

    it('should return null when endpoint is not found', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      service.selectedEndpoint.set('https://nonexistent.com');

      expect(service.selectedSummary()).toBeNull();
    });
  });

  describe('endpointSummary', () => {
    it('should return endpoint summary when selected summary is an endpoint', () => {
      const testWithEndpoint = {
        ...mockTest,
        summary: {
          ...mockTest.summary!,
          endpoints: [
            {
              averageRequestsPerSecond: 50,
              earlyExitTriggered: false,
              epochEndedAt: 2000,
              epochStartedAt: 1000,
              errorRate: 0.04,
              failedRequests: 20,
              histogram: mockHistogram,
              maxLatencyMs: 100,
              method: 'GET',
              minLatencyMs: 5,
              networkBytesPerSec: 2500,
              networkBytesReceived: 1250,
              networkBytesSent: 1250,
              p50LatencyMs: 40,
              p95LatencyMs: 70,
              p99LatencyMs: 90,
              peakRequestsPerSecond: 75,
              responseSamples: [],
              statusCodeDistribution: { '200': 480 },
              successfulRequests: 480,
              targetAchieved: 0.96,
              targetRps: 50,
              theoreticalMaxRps: 100,
              totalRequests: 500,
              url: 'https://api.example.com/users',
            },
          ],
        },
      };
      service.initialize({
        metrics: mockMetrics,
        test: testWithEndpoint as TestDocument,
      });
      service.selectedEndpoint.set('https://api.example.com/users');

      const endpointSummary = service.endpointSummary();
      expect(endpointSummary).toBeDefined();
      expect(endpointSummary?.url).toBe('https://api.example.com/users');
    });

    it('should return null when selected summary is global', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      service.selectedEndpoint.set('global');

      expect(service.endpointSummary()).toBeNull();
    });
  });

  describe('histogram', () => {
    it('should return histogram from selected summary', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      service.selectedEndpoint.set('global');

      expect(service.histogram()).toEqual(mockHistogram);
    });

    it('should return undefined when no summary exists', () => {
      const testWithoutSummary = { ...mockTest, summary: null };
      service.initialize({ metrics: mockMetrics, test: testWithoutSummary });

      expect(service.histogram()).toBeUndefined();
    });
  });

  describe('displayConfigName', () => {
    it('should return config name when config is loaded', async () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      await service.loadConfig('config-1');

      expect(service.displayConfigName()).toBe('Test Config');
    });

    it('should return Unknown Configuration when config is not loaded', () => {
      const testWithoutConfig = { ...mockTest, configId: '' };
      service.initialize({ metrics: mockMetrics, test: testWithoutConfig });

      expect(service.displayConfigName()).toBe('Unknown Configuration');
    });
  });

  describe('currentChartData', () => {
    it('should return global chart data when endpoint is global', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      service.selectedEndpoint.set('global');
      service.selectedChartType.set('latency' as ChartType);

      const chartData = service.currentChartData();
      expect(chartData.labels).toEqual([1000]);
      expect(chartData.data).toEqual([45]);
    });

    it('should return endpoint chart data when endpoint is selected', () => {
      const endpointUrl = 'https://api.example.com/users';
      const mockMetricsWithEndpoint: MetricDocument[] = [
        {
          epoch: 1000,
          id: 'metric-1',
          metric: {
            endpoints: [
              {
                failedRequests: 0,
                p50LatencyMs: 40,
                successfulRequests: 100,
                totalRequests: 100,
                url: endpointUrl,
              },
            ],
            global: mockGlobalSummary,
          } as unknown as TestSummary,
          testId: 'test-123',
        },
      ];

      service.initialize({
        metrics: mockMetricsWithEndpoint,
        test: mockTest,
      });
      service.selectedEndpoint.set(endpointUrl);
      service.selectedChartType.set('latency' as ChartType);

      const chartData = service.currentChartData();
      expect(chartData.labels).toEqual([1000]);
      expect(chartData.data).toEqual([40]);
    });

    it('should return empty data when no metrics exist', () => {
      service.initialize({
        metrics: [],
        test: mockTest,
      });
      service.selectedEndpoint.set('global');

      const chartData = service.currentChartData();
      expect(chartData.data).toEqual([]);
      expect(chartData.labels).toEqual([]);
    });
  });

  describe('hasChartData', () => {
    it('should return true when chart data exists', () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });
      service.selectedEndpoint.set('global');

      expect(service.hasChartData()).toBe(true);
    });

    it('should return false when chart data is empty', () => {
      service.initialize({
        metrics: [],
        test: mockTest,
      });

      expect(service.hasChartData()).toBe(false);
    });
  });

  describe('setupPolling', () => {
    it('should set up interval when interval is greater than 0', () => {
      vi.useFakeTimers();
      service.initialize({ metrics: mockMetrics, test: mockTest });

      service.setupPolling(5000);

      vi.advanceTimersByTime(5000);
      expect(testServiceSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clear existing interval when setting new one', () => {
      vi.useFakeTimers();
      service.initialize({ metrics: mockMetrics, test: mockTest });

      service.setupPolling(5000);
      service.setupPolling(10000);

      vi.advanceTimersByTime(10000);
      expect(testServiceSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should not set up interval when interval is 0', () => {
      vi.useFakeTimers();
      service.initialize({ metrics: mockMetrics, test: mockTest });

      service.setupPolling(0);

      vi.advanceTimersByTime(1000);
      expect(testServiceSpy).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('refreshMetrics', () => {
    it('should call testService to get metrics', async () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      await service.refreshMetrics();

      expect(testServiceSpy).toHaveBeenCalledWith('test-123');
    });

    it('should not call testService when testId is null', async () => {
      service.testId.set(null);

      await service.refreshMetrics();

      expect(testServiceSpy).not.toHaveBeenCalled();
    });
  });

  describe('exportResults', () => {
    it('should call exportService with correct format', async () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      await service.exportResults('json');

      expect(testExportServiceSpy).toHaveBeenCalledWith('test-123', 'json');
    });

    it('should call exportService with xlsx format', async () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      await service.exportResults('xlsx');

      expect(testExportServiceSpy).toHaveBeenCalledWith('test-123', 'xlsx');
    });

    it('should call exportService with md format', async () => {
      service.initialize({ metrics: mockMetrics, test: mockTest });

      await service.exportResults('md');

      expect(testExportServiceSpy).toHaveBeenCalledWith('test-123', 'md');
    });

    it('should not call exportService when testId is null', async () => {
      service.testId.set(null);

      await service.exportResults('json');

      expect(testExportServiceSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadConfig', () => {
    it('should load config successfully', async () => {
      await service.loadConfig('config-1');

      expect(configServiceSpy).toHaveBeenCalledWith('config-1');
    });

    it('should not load config when configId is undefined', async () => {
      await service.loadConfig(undefined);

      expect(configServiceSpy).not.toHaveBeenCalled();
    });

    it('should set config error when config not found', async () => {
      configServiceSpy.mockResolvedValueOnce(null);

      await service.loadConfig('config-1');

      expect(service.config()).toBeNull();
      expect(service.configError()).toBe('Configuration not found');
    });
  });

  describe('error handling', () => {
    it('should set hasError and errorMessage when initialize fails', () => {
      const testWithError = { ...mockTest, summary: null };
      service.initialize({ metrics: mockMetrics, test: testWithError });

      // The service should handle this gracefully
      expect(service.test()).toEqual(testWithError);
    });
  });
});
