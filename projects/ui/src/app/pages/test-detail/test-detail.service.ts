import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import {
  ConfigDocument,
  EndpointSummary,
  GlobalSummary,
  MetricDocument,
  TestDocument,
  TestEventData,
  TestMetrics,
} from '@tressi/shared/common';
import {
  ChartData,
  ChartType,
  DEFAULT_CHART_TYPE,
  EndpointChartDataCache,
  PollingInterval,
} from '@tressi/shared/ui';
import { TestSummaryData } from '@tressi/shared/ui';
import { Subscription } from 'rxjs';

import { ConfigService } from '../../services/config.service';
import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { TestService } from '../../services/test.service';
import { TestExportService } from '../../services/test-export.service';
import { isEndpointSummary } from './test-detail-shared.utils';

@Injectable()
export class TestDetailService implements OnDestroy {
  private readonly _testService = inject(TestService);
  private readonly _logService = inject(LogService);
  private readonly _configService = inject(ConfigService);
  private readonly _eventService = inject(EventService);
  private readonly _testExportService = inject(TestExportService);

  // Data Signals
  readonly test = signal<TestDocument | null>(null);
  readonly metrics = signal<TestMetrics | null>(null);
  readonly config = signal<ConfigDocument | null>(null);
  readonly testId = signal<string | null>(null);
  readonly testTimeRange = signal<{ min: number; max: number } | null>(null);

  // UI State Signals (shared)
  readonly selectedEndpoint = signal<string>('global');
  readonly selectedChartType = signal<ChartType>(DEFAULT_CHART_TYPE);
  readonly selectedPollingInterval = signal<PollingInterval>(5000);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly configError = signal<string>('');

  // Computed Signals
  readonly isRealTime = computed(() => this.test()?.status === 'running');

  readonly selectedSummary = computed(
    (): GlobalSummary | EndpointSummary | null => {
      const test = this.test();
      if (!test?.summary) return null;

      const isGlobal = this.selectedEndpoint() === 'global';
      if (isGlobal) {
        return test.summary.global;
      } else {
        const endpointUrl = this.selectedEndpoint();
        return (
          test.summary.endpoints?.find((e) => e.url === endpointUrl) || null
        );
      }
    },
  );

  readonly endpointSummary = computed((): EndpointSummary | null => {
    const summary = this.selectedSummary();
    return isEndpointSummary(summary) ? summary : null;
  });

  readonly histogram = computed(() => {
    const summary = this.selectedSummary();
    if (summary && typeof summary === 'object' && 'histogram' in summary) {
      return summary.histogram;
    }
    return undefined;
  });

  readonly displayConfigName = computed(() => {
    return this.config()?.name || 'Unknown Configuration';
  });

  readonly currentChartData = computed(() => {
    const endpoint = this.selectedEndpoint();
    const chartType = this.selectedChartType();
    const metrics = this.metrics();

    if (!metrics) return { data: [], labels: [] };

    if (endpoint === 'global') {
      return this._getGlobalChartData(chartType);
    } else {
      return this.getCachedEndpointChartData(endpoint, chartType);
    }
  });

  readonly hasChartData = computed(() => {
    const data = this.currentChartData().data;
    if (Array.isArray(data)) {
      return data.length > 0;
    } else if (typeof data === 'object' && data !== null) {
      return Object.values(data).some(
        (series) => Array.isArray(series) && series.length > 0,
      );
    }
    return false;
  });

  // Cache for endpoint chart data
  private readonly _cachedEndpointChartData: EndpointChartDataCache = new Map();

  // Subscriptions
  private _metricsStreamSubscription: Subscription | null = null;
  private _testEventsSubscription: Subscription | null = null;
  private _pollingTimerId: ReturnType<typeof setInterval> | null = null;

  initialize(data: { test: TestDocument; metrics: TestMetrics | null }): void {
    this.testId.set(data.test.id);
    this.test.set(data.test);
    this.metrics.set(data.metrics);

    if (data.test.summary?.global) {
      this.testTimeRange.set({
        min: data.test.summary.global.epochStartedAt,
        max: data.test.summary.global.epochEndedAt,
      });
    }

    if (data.test.configId) {
      this.loadConfig(data.test.configId);
    }

    this.startRealTimeUpdates(data.test.id);
  }

  async loadConfig(configId: string | undefined): Promise<void> {
    if (!configId) return;
    this.configError.set('');
    try {
      const configData = await this._configService.getOne(configId);
      this.config.set(configData || null);
      if (!configData) this.configError.set('Configuration not found');
    } catch (error) {
      this.config.set(null);
      this.configError.set(
        error instanceof Error ? error.message : 'Failed to load configuration',
      );
      this._logService.error('Failed to load configuration', error);
    }
  }

  setupPolling(interval: number): void {
    if (this._pollingTimerId) {
      clearInterval(this._pollingTimerId);
      this._pollingTimerId = null;
    }
    if (interval > 0) {
      this._pollingTimerId = setInterval(() => {
        this.refreshMetrics();
      }, interval);
    }
  }

  async refreshMetrics(): Promise<void> {
    const testId = this.testId();
    if (!testId) return;
    try {
      const metricsResult = await this._testService.getTestMetrics(testId);
      this.metrics.set(metricsResult);
    } catch (error) {
      this._logService.error('Failed to refresh metrics', error);
    }
  }

  startRealTimeUpdates(testId: string | null): void {
    if (!testId) return;
    this._cleanupSubscriptions();

    this._metricsStreamSubscription = this._eventService
      .getMetricsStream()
      .subscribe({
        next: (data: TestSummaryData) => {
          if (data.testId === testId) {
            const currentTest = this.test();
            if (currentTest) {
              this.test.set({ ...currentTest, summary: data.testSummary });
            }
          }
        },
        error: (error) =>
          this._logService.error('Realtime metrics error:', error),
      });

    this._testEventsSubscription = this._eventService
      .getTestEventsStream()
      .subscribe({
        next: (event: TestEventData) => {
          if (event.testId === testId) {
            const currentTest = this.test();
            if (currentTest) {
              this.test.set({ ...currentTest, status: event.status });
            }
            if (
              event.status === 'completed' ||
              event.status === 'failed' ||
              event.status === 'cancelled'
            ) {
              this._cleanupSubscriptions();
            }
          }
        },
        error: (error) => this._logService.error('Test events error:', error),
      });
  }

  async exportResults(format: 'json' | 'xlsx' | 'md'): Promise<void> {
    const testId = this.testId();
    if (!testId) return;
    try {
      await this._testExportService.exportTest(testId, format);
    } catch (error) {
      this._logService.error('Export failed', error);
    }
  }

  getCachedEndpointChartData(url: string, metricType: ChartType): ChartData {
    const cacheKey = `${url}-${metricType}`;
    if (!this._cachedEndpointChartData.has(url)) {
      this._cachedEndpointChartData.set(url, new Map());
    }
    const urlCache = this._cachedEndpointChartData.get(url)!;
    if (urlCache.has(cacheKey)) {
      return urlCache.get(cacheKey)!;
    }

    const metrics = this.metrics();
    if (!metrics?.endpoints?.length) {
      const emptyData = { data: [], labels: [] };
      urlCache.set(cacheKey, emptyData);
      return emptyData;
    }

    const endpointMetrics = metrics.endpoints.filter((m) => m.url === url);
    const labels = endpointMetrics.map((m) => m.epoch);
    const data = this._mapMetricsToData(endpointMetrics, metricType);

    const chartData = { data, labels };
    urlCache.set(cacheKey, chartData);
    return chartData;
  }

  private _getGlobalChartData(metricType: ChartType): ChartData {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return { data: [], labels: [] };

    return {
      data: this._mapMetricsToData(metrics.global, metricType),
      labels: metrics.global.map((m) => m.epoch),
    };
  }

  private _mapMetricsToData(
    metrics: MetricDocument[],
    metricType: ChartType,
  ): number[] {
    switch (metricType) {
      case 'peak_throughput':
        return metrics.map((m) => m.metric?.peakRequestsPerSecond || 0);
      case 'average_throughput':
        return metrics.map((m) => m.metric?.averageRequestsPerSecond || 0);
      case 'latency':
        return metrics.map((m) => m.metric?.p50LatencyMs || 0);
      case 'latency_p95':
        return metrics.map((m) => m.metric?.p95LatencyMs || 0);
      case 'latency_p99':
        return metrics.map((m) => m.metric?.p99LatencyMs || 0);
      case 'error_rate':
        return metrics.map((m) => (m.metric?.errorRate || 0) * 100);
      case 'success_rate':
        return metrics.map(
          (m) =>
            ((m.metric?.successfulRequests || 0) /
              (m.metric?.totalRequests || 1)) *
            100,
        );
      case 'failed_requests':
        return metrics.map((m) => m.metric?.failedRequests || 0);
      case 'network_throughput':
        return metrics.map((m) => m.metric?.networkBytesPerSec || 0);
      case 'network_bytes_sent':
        return metrics.map((m) => m.metric?.networkBytesSent || 0);
      case 'network_bytes_received':
        return metrics.map((m) => m.metric?.networkBytesReceived || 0);
      case 'target_achieved':
        return metrics.map((m) => (m.metric?.targetAchieved || 0) * 100);
      default:
        return [];
    }
  }

  private _cleanupSubscriptions(): void {
    if (this._pollingTimerId) {
      clearInterval(this._pollingTimerId);
      this._pollingTimerId = null;
    }
    this._metricsStreamSubscription?.unsubscribe();
    this._testEventsSubscription?.unsubscribe();
    this._metricsStreamSubscription = null;
    this._testEventsSubscription = null;
  }

  ngOnDestroy(): void {
    this._cleanupSubscriptions();
  }
}
