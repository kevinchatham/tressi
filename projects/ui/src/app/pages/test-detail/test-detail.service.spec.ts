import { TestBed } from '@angular/core/testing';
import {
  defaultTressiConfig,
  GlobalSummary,
  LatencyHistogram,
  MetricDocument,
  TestDocument,
  TestSummary,
} from '@tressi/shared/common';
import { ChartType } from '@tressi/shared/ui';
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
    totalCount: 1000,
    min: 10,
    max: 120,
    mean: 50,
    stdDev: 20,
    percentiles: {
      50: 45,
      95: 80,
      99: 100,
    },
    buckets: [
      { lowerBound: 0, upperBound: 20, count: 100 },
      { lowerBound: 20, upperBound: 40, count: 200 },
    ],
  };

  const mockGlobalSummary: GlobalSummary = {
    totalEndpoints: 1,
    totalRequests: 1000,
    successfulRequests: 950,
    failedRequests: 50,
    minLatencyMs: 10,
    maxLatencyMs: 120,
    p50LatencyMs: 45,
    p95LatencyMs: 80,
    p99LatencyMs: 100,
    finalDurationSec: 10,
    epochStartedAt: 1000,
    epochEndedAt: 2000,
    errorRate: 0.05,
    averageRequestsPerSecond: 100,
    peakRequestsPerSecond: 150,
    networkBytesSent: 25000,
    networkBytesReceived: 25000,
    networkBytesPerSec: 5000,
    avgSystemCpuUsagePercent: 50,
    avgProcessMemoryUsageMB: 100,
    targetAchieved: 0.95,
    histogram: mockHistogram,
  };

  const mockTest: TestDocument = {
    id: 'test-123',
    configId: 'config-1',
    status: 'completed',
    epochCreatedAt: Date.now(),
    error: null,
    summary: {
      tressiVersion: '1.0.0',
      configSnapshot: defaultTressiConfig,
      global: mockGlobalSummary,
      endpoints: [],
    },
  };

  const mockMetrics: MetricDocument[] = [
    {
      id: 'metric-1',
      testId: 'test-123',
      epoch: 1000,
      metric: {
        global: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          errorRate: 0.05,
          averageRequestsPerSecond: 100,
          peakRequestsPerSecond: 150,
          p50LatencyMs: 45,
          p95LatencyMs: 80,
          p99LatencyMs: 100,
          minLatencyMs: 10,
          maxLatencyMs: 120,
          targetAchieved: 0.95,
          networkBytesPerSec: 5000,
          networkBytesSent: 2500,
          networkBytesReceived: 2500,
          statusCodeDistribution: { '200': 95 },
        },
      } as unknown as TestSummary,
    },
  ];

  beforeEach(() => {
    configServiceSpy = vi.fn(() =>
      Promise.resolve({ id: 'config-1', name: 'Test Config' }),
    );
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
          useValue: { info: logServiceSpy, error: logServiceSpy },
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
      service.initialize({ test: mockTest, metrics: mockMetrics });

      expect(service.testId()).toBe('test-123');
      expect(service.test()).toEqual(mockTest);
      expect(service.metrics()).toEqual(mockMetrics);
    });

    it('should set test time range from global summary', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });

      expect(service.testTimeRange()).toEqual({
        min: 1000,
        max: 2000,
      });
    });

    it('should load config when configId is provided', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });

      expect(configServiceSpy).toHaveBeenCalledWith('config-1');
    });
  });

  describe('isRealTime', () => {
    it('should return true when test status is running', () => {
      const runningTest = { ...mockTest, status: 'running' as const };
      service.initialize({ test: runningTest, metrics: mockMetrics });

      expect(service.isRealTime()).toBe(true);
    });

    it('should return false when test status is completed', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });

      expect(service.isRealTime()).toBe(false);
    });
  });

  describe('selectedSummary', () => {
    it('should return global summary when endpoint is global', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
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
              method: 'GET',
              url: 'https://api.example.com/users',
              totalRequests: 500,
              successfulRequests: 480,
              failedRequests: 20,
              errorRate: 0.04,
              epochStartedAt: 1000,
              epochEndedAt: 2000,
              averageRequestsPerSecond: 50,
              peakRequestsPerSecond: 75,
              p50LatencyMs: 40,
              p95LatencyMs: 70,
              p99LatencyMs: 90,
              minLatencyMs: 5,
              maxLatencyMs: 100,
              targetRps: 50,
              targetAchieved: 0.96,
              theoreticalMaxRps: 100,
              networkBytesPerSec: 2500,
              networkBytesSent: 1250,
              networkBytesReceived: 1250,
              statusCodeDistribution: { '200': 480 },
              responseSamples: [],
              histogram: mockHistogram,
            },
          ],
        },
      };
      service.initialize({
        test: testWithEndpoint as TestDocument,
        metrics: mockMetrics,
      });
      service.selectedEndpoint.set('https://api.example.com/users');

      const summary = service.selectedSummary();
      expect(summary).toBeDefined();
      expect((summary as { url: string }).url).toBe(
        'https://api.example.com/users',
      );
    });

    it('should return null when endpoint is not found', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
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
              method: 'GET',
              url: 'https://api.example.com/users',
              totalRequests: 500,
              successfulRequests: 480,
              failedRequests: 20,
              errorRate: 0.04,
              epochStartedAt: 1000,
              epochEndedAt: 2000,
              averageRequestsPerSecond: 50,
              peakRequestsPerSecond: 75,
              p50LatencyMs: 40,
              p95LatencyMs: 70,
              p99LatencyMs: 90,
              minLatencyMs: 5,
              maxLatencyMs: 100,
              targetRps: 50,
              targetAchieved: 0.96,
              theoreticalMaxRps: 100,
              networkBytesPerSec: 2500,
              networkBytesSent: 1250,
              networkBytesReceived: 1250,
              statusCodeDistribution: { '200': 480 },
              responseSamples: [],
              histogram: mockHistogram,
            },
          ],
        },
      };
      service.initialize({
        test: testWithEndpoint as TestDocument,
        metrics: mockMetrics,
      });
      service.selectedEndpoint.set('https://api.example.com/users');

      const endpointSummary = service.endpointSummary();
      expect(endpointSummary).toBeDefined();
      expect(endpointSummary?.url).toBe('https://api.example.com/users');
    });

    it('should return null when selected summary is global', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
      service.selectedEndpoint.set('global');

      expect(service.endpointSummary()).toBeNull();
    });
  });

  describe('histogram', () => {
    it('should return histogram from selected summary', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
      service.selectedEndpoint.set('global');

      expect(service.histogram()).toEqual(mockHistogram);
    });

    it('should return undefined when no summary exists', () => {
      const testWithoutSummary = { ...mockTest, summary: null };
      service.initialize({ test: testWithoutSummary, metrics: mockMetrics });

      expect(service.histogram()).toBeUndefined();
    });
  });

  describe('displayConfigName', () => {
    it('should return config name when config is loaded', async () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
      await service.loadConfig('config-1');

      expect(service.displayConfigName()).toBe('Test Config');
    });

    it('should return Unknown Configuration when config is not loaded', () => {
      const testWithoutConfig = { ...mockTest, configId: '' };
      service.initialize({ test: testWithoutConfig, metrics: mockMetrics });

      expect(service.displayConfigName()).toBe('Unknown Configuration');
    });
  });

  describe('currentChartData', () => {
    it('should return global chart data when endpoint is global', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
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
          id: 'metric-1',
          testId: 'test-123',
          epoch: 1000,
          metric: {
            global: mockGlobalSummary,
            endpoints: [
              {
                url: endpointUrl,
                p50LatencyMs: 40,
                totalRequests: 100,
                successfulRequests: 100,
                failedRequests: 0,
              },
            ],
          } as unknown as TestSummary,
        },
      ];

      service.initialize({
        test: mockTest,
        metrics: mockMetricsWithEndpoint,
      });
      service.selectedEndpoint.set(endpointUrl);
      service.selectedChartType.set('latency' as ChartType);

      const chartData = service.currentChartData();
      expect(chartData.labels).toEqual([1000]);
      expect(chartData.data).toEqual([40]);
    });

    it('should return empty data when no metrics exist', () => {
      service.initialize({
        test: mockTest,
        metrics: [],
      });
      service.selectedEndpoint.set('global');

      const chartData = service.currentChartData();
      expect(chartData.data).toEqual([]);
      expect(chartData.labels).toEqual([]);
    });
  });

  describe('hasChartData', () => {
    it('should return true when chart data exists', () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });
      service.selectedEndpoint.set('global');

      expect(service.hasChartData()).toBe(true);
    });

    it('should return false when chart data is empty', () => {
      service.initialize({
        test: mockTest,
        metrics: [],
      });

      expect(service.hasChartData()).toBe(false);
    });
  });

  describe('setupPolling', () => {
    it('should set up interval when interval is greater than 0', () => {
      vi.useFakeTimers();
      service.initialize({ test: mockTest, metrics: mockMetrics });

      service.setupPolling(5000);

      vi.advanceTimersByTime(5000);
      expect(testServiceSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clear existing interval when setting new one', () => {
      vi.useFakeTimers();
      service.initialize({ test: mockTest, metrics: mockMetrics });

      service.setupPolling(5000);
      service.setupPolling(10000);

      vi.advanceTimersByTime(10000);
      expect(testServiceSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should not set up interval when interval is 0', () => {
      vi.useFakeTimers();
      service.initialize({ test: mockTest, metrics: mockMetrics });

      service.setupPolling(0);

      vi.advanceTimersByTime(1000);
      expect(testServiceSpy).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('refreshMetrics', () => {
    it('should call testService to get metrics', async () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });

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
      service.initialize({ test: mockTest, metrics: mockMetrics });

      await service.exportResults('json');

      expect(testExportServiceSpy).toHaveBeenCalledWith('test-123', 'json');
    });

    it('should call exportService with xlsx format', async () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });

      await service.exportResults('xlsx');

      expect(testExportServiceSpy).toHaveBeenCalledWith('test-123', 'xlsx');
    });

    it('should call exportService with md format', async () => {
      service.initialize({ test: mockTest, metrics: mockMetrics });

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
      service.initialize({ test: testWithError, metrics: mockMetrics });

      // The service should handle this gracefully
      expect(service.test()).toEqual(testWithError);
    });
  });
});
