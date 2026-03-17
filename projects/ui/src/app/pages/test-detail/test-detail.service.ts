import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import {
  ConfigDocument,
  EndpointSummary,
  GlobalSummary,
  MetricDocument,
  TestDocument,
  TestEventData,
} from '@tressi/shared/common';
import {
  ChartType,
  DEFAULT_CHART_POLLING_INTERVAL,
  DEFAULT_CHART_TYPE,
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
  readonly metrics = signal<MetricDocument[] | null>(null);
  readonly config = signal<ConfigDocument | null>(null);
  readonly testId = signal<string | null>(null);
  readonly testTimeRange = signal<{ min: number; max: number } | null>(null);

  // UI State Signals (shared)
  readonly selectedEndpoint = signal<string>('global');
  readonly selectedChartType = signal<ChartType>(DEFAULT_CHART_TYPE);
  readonly selectedPollingInterval = signal<PollingInterval>(
    DEFAULT_CHART_POLLING_INTERVAL,
  );
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

    if (!metrics || metrics.length === 0) return { data: [], labels: [] };

    const labels = metrics.map((m) => m.epoch);
    const data =
      endpoint === 'global'
        ? this._mapMetricsToData(metrics, chartType)
        : this._mapEndpointMetricsToData(metrics, endpoint, chartType);

    return { data, labels };
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

  // Subscriptions
  private _metricsStreamSubscription: Subscription | null = null;
  private _testEventsSubscription: Subscription | null = null;
  private _pollingTimerId: ReturnType<typeof setInterval> | null = null;

  initialize(data: {
    test: TestDocument;
    metrics: MetricDocument[] | null;
  }): void {
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

  private _mapMetricsToData(
    metrics: MetricDocument[],
    metricType: ChartType,
  ): number[] {
    switch (metricType) {
      case 'peak_throughput':
        return metrics.map((m) => m.metric?.global?.peakRequestsPerSecond || 0);
      case 'average_throughput':
        return metrics.map(
          (m) => m.metric?.global?.averageRequestsPerSecond || 0,
        );
      case 'latency':
        return metrics.map((m) => m.metric?.global?.p50LatencyMs || 0);
      case 'latency_p95':
        return metrics.map((m) => m.metric?.global?.p95LatencyMs || 0);
      case 'latency_p99':
        return metrics.map((m) => m.metric?.global?.p99LatencyMs || 0);
      case 'error_rate':
        return metrics.map((m) => (m.metric?.global?.errorRate || 0) * 100);
      case 'success_rate':
        return metrics.map(
          (m) =>
            ((m.metric?.global?.successfulRequests || 0) /
              (m.metric?.global?.totalRequests || 1)) *
            100,
        );
      case 'failed_requests':
        return metrics.map((m) => m.metric?.global?.failedRequests || 0);
      case 'network_throughput':
        return metrics.map((m) => m.metric?.global?.networkBytesPerSec || 0);
      case 'network_bytes_sent':
        return metrics.map((m) => m.metric?.global?.networkBytesSent || 0);
      case 'network_bytes_received':
        return metrics.map((m) => m.metric?.global?.networkBytesReceived || 0);
      case 'target_achieved':
        return metrics.map(
          (m) => (m.metric?.global?.targetAchieved || 0) * 100,
        );
      default:
        return [];
    }
  }

  private _mapEndpointMetricsToData(
    metrics: MetricDocument[],
    url: string,
    metricType: ChartType,
  ): number[] {
    const getEndpoint = (
      m: MetricDocument,
    ): import('@tressi/shared/common').EndpointSummary | undefined =>
      m.metric?.endpoints?.find((e) => e.url === url);

    switch (metricType) {
      case 'peak_throughput':
        return metrics.map((m) => getEndpoint(m)?.peakRequestsPerSecond || 0);
      case 'average_throughput':
        return metrics.map(
          (m) => getEndpoint(m)?.averageRequestsPerSecond || 0,
        );
      case 'latency':
        return metrics.map((m) => getEndpoint(m)?.p50LatencyMs || 0);
      case 'latency_p95':
        return metrics.map((m) => getEndpoint(m)?.p95LatencyMs || 0);
      case 'latency_p99':
        return metrics.map((m) => getEndpoint(m)?.p99LatencyMs || 0);
      case 'error_rate':
        return metrics.map((m) => (getEndpoint(m)?.errorRate || 0) * 100);
      case 'success_rate':
        return metrics.map((m) => {
          const e = getEndpoint(m);
          return ((e?.successfulRequests || 0) / (e?.totalRequests || 1)) * 100;
        });
      case 'failed_requests':
        return metrics.map((m) => getEndpoint(m)?.failedRequests || 0);
      case 'target_achieved':
        return metrics.map((m) => (getEndpoint(m)?.targetAchieved || 0) * 100);
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
