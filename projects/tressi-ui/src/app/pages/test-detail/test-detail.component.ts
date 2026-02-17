import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { TestDetailResolvedData } from '../../resolvers/test-detail.resolver';
import { ConfigService } from '../../services/config.service';
import { EventService, TestEventData } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import {
  type ConfigDocument,
  EndpointSummary,
  GlobalSummary,
  TestDocument,
  TestMetrics,
  TestSummary,
} from '../../services/rpc.service';
import { TestService } from '../../services/test.service';
import { TestExportService } from '../../services/test-export.service';
import {
  CHART_OPTIONS,
  ChartData,
  ChartType,
  DEFAULT_CHART_TYPE,
  POLLING_OPTIONS,
  PollingInterval,
} from '../../types/chart.types';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';
import { LatencyDistributionComponent } from './latency-distribution/latency-distribution.component';
import { PerformanceOverTimeComponent } from './performance-over-time/performance-over-time.component';
import { PerformanceSummaryComponent } from './performance-summary/performance-summary.component';
import { ResponseSamplesCardComponent } from './response-samples-card/response-samples-card.component';
import { EndpointChartDataCache } from './test-detail.types';
import { isEndpointSummary } from './test-detail-shared.types';
import { TestHeroStatsComponent } from './test-hero-stats/test-hero-stats.component';
import { TestMetadataComponent } from './test-metadata/test-metadata.component';

@Component({
  selector: 'app-test-detail',
  imports: [
    HeaderComponent,
    IconComponent,
    DeleteConfirmationModalComponent,
    ButtonComponent,
    PerformanceSummaryComponent,
    PerformanceOverTimeComponent,
    TestHeroStatsComponent,
    TestMetadataComponent,
    LatencyDistributionComponent,
    ResponseSamplesCardComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './test-detail.component.html',
})
export class TestDetailComponent implements OnDestroy {
  readonly appRouter = inject(AppRouterService);

  private readonly _route = inject(ActivatedRoute);
  private readonly _testService = inject(TestService);
  private readonly _logService = inject(LogService);
  private readonly _configService = inject(ConfigService);
  private readonly _eventService = inject(EventService);
  private readonly _testExportService = inject(TestExportService);

  // Signals - moved from TestDetailService
  readonly test = signal<TestDocument | null>(null);
  readonly metrics = signal<TestMetrics | null>(null);
  readonly selectedEndpoint = signal<string>('global');

  // Computed signals - moved from TestDetailService
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

  // Computed signal that returns the endpoint summary with proper typing
  // Only returns a value if the selected summary is an EndpointSummary
  readonly endpointSummary = computed((): EndpointSummary | null => {
    const summary = this.selectedSummary();
    if (isEndpointSummary(summary)) {
      return summary;
    }
    return null;
  });

  // Computed signal for histogram
  readonly histogram = computed(() => {
    const summary = this.selectedSummary();
    if (summary && typeof summary === 'object' && 'histogram' in summary) {
      return summary.histogram;
    }
    return undefined;
  });

  // Component signals
  readonly testId = signal<string | null>(null);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly isDeleting = signal(false);
  readonly showDeleteModal = signal(false);
  readonly selectedChartType = signal<ChartType>(DEFAULT_CHART_TYPE);
  readonly chartOptions = CHART_OPTIONS;
  readonly availableChartOptions = computed(() => {
    return CHART_OPTIONS;
  });

  readonly selectedPollingInterval = signal<PollingInterval>(5000);
  readonly pollingOptions = POLLING_OPTIONS;

  // Config signals
  readonly config = signal<ConfigDocument | null>(null);
  readonly configError = signal<string>('');

  // Collapsible state
  readonly configCollapsed = signal(true);
  readonly performanceSummaryCollapsed = signal(false);
  readonly performanceOverTimeCollapsed = signal(false);
  readonly latencyDistributionCollapsed = signal(false);
  readonly responseSamplesCollapsed = signal(false);

  // Computed signals for component
  readonly testData = computed(() => this.test());
  readonly metricsData = computed(() => this.metrics());
  readonly isRealTime = computed(() => this.testData()?.status === 'running');

  // Global test time range for all charts - static snapshot
  readonly testTimeRange = signal<{ min: number; max: number } | null>(null);

  // Computed chart data - decoupled from real-time test updates
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
      // Multi-series data - check if any series has data
      return Object.values(data).some(
        (series) => Array.isArray(series) && series.length > 0,
      );
    }

    return false;
  });

  readonly displayConfigName = computed(() => {
    const config = this.config();
    return config?.name || 'Unknown Configuration';
  });

  // Cache for endpoint chart data
  private readonly _cachedEndpointChartData: EndpointChartDataCache = new Map();

  // Private state for subscriptions - moved from TestDetailService
  private _metricsStreamSubscription: Subscription | null = null;
  private _testEventsSubscription: Subscription | null = null;
  private _pollingTimerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Initialize from resolved data
    const resolvedData = this._route.snapshot.data[
      'data'
    ] as TestDetailResolvedData;
    if (resolvedData) {
      this.testId.set(resolvedData.test.id);
      this.test.set(resolvedData.test);
      this.metrics.set(resolvedData.metrics);

      // Set static time range for charts from the initial load
      if (resolvedData.test.summary?.global) {
        this.testTimeRange.set({
          min: resolvedData.test.summary.global.epochStartedAt,
          max: resolvedData.test.summary.global.epochEndedAt,
        });
      }

      // Load config after test data is loaded
      if (resolvedData.test.configId) {
        this.loadConfig(resolvedData.test.configId);
      }

      // Set up real-time updates
      this.startRealTimeUpdates(resolvedData.test.id);
    }

    // Effect to handle polling interval changes
    effect(() => {
      const interval = this.selectedPollingInterval();
      const isRunning = this.isRealTime();

      if (!isRunning && interval !== 0) {
        this.selectedPollingInterval.set(0);
        return;
      }

      if (isRunning && interval === 0) {
        this.selectedPollingInterval.set(5000);
        return;
      }

      this._setupPolling(interval);
    });
  }

  async loadConfig(configId: string | undefined): Promise<void> {
    if (!configId) return;

    this.configError.set('');

    try {
      const configData = await this._configService.getOne(configId);
      if (configData) {
        this.config.set(configData);
      } else {
        this.config.set(null);
        this.configError.set('Configuration not found');
      }
    } catch (error) {
      this.config.set(null);
      this.configError.set(
        error instanceof Error ? error.message : 'Failed to load configuration',
      );
      this._logService.error('Failed to load configuration', error);
    }
  }

  private _setupPolling(interval: number): void {
    // Clear existing timer
    if (this._pollingTimerId) {
      clearInterval(this._pollingTimerId);
      this._pollingTimerId = null;
    }

    // Set up new timer if interval > 0
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

  // Moved from TestDetailService - real-time subscription management
  startRealTimeUpdates(testId: string | null): void {
    if (!testId) return;

    // Clean up existing subscriptions
    this._cleanupSubscriptions();

    // Subscribe to metrics stream for real-time updates
    this._metricsStreamSubscription = this._eventService
      .getMetricsStream()
      .subscribe({
        next: (data) => {
          if (data.testId === testId) {
            this._mergeRealTimeMetrics(data.testSummary);
          }
        },
        error: (error: unknown) => {
          this._logService.error('Real-time metrics error:', error);
        },
      });

    // Subscribe to test events for completion/failure notifications
    this._testEventsSubscription = this._eventService
      .getTestEventsStream()
      .subscribe({
        next: (event: TestEventData) => {
          if (event.testId === testId) {
            this._handleTestEvent(event);
          }
        },
        error: (error: unknown) => {
          this._logService.error('Test events error:', error);
        },
      });
  }

  private _mergeRealTimeMetrics(testSummary: TestSummary): void {
    const currentTest = this.test();
    if (!currentTest) return;

    // Update the test summary with real-time data
    this.test.set({
      ...currentTest,
      summary: testSummary,
    });
  }

  private _handleTestEvent(event: TestEventData): void {
    const currentTest = this.test();
    if (!currentTest || currentTest.id !== event.testId) return;

    // Update test status
    this.test.set({
      ...currentTest,
      status: event.status,
    });

    // Stop real-time updates when test completes
    if (event.status === 'completed' || event.status === 'failed') {
      this._cleanupSubscriptions();
    }
  }

  private _cleanupSubscriptions(): void {
    if (this._pollingTimerId) {
      clearInterval(this._pollingTimerId);
      this._pollingTimerId = null;
    }

    if (this._metricsStreamSubscription) {
      this._metricsStreamSubscription.unsubscribe();
      this._metricsStreamSubscription = null;
    }

    if (this._testEventsSubscription) {
      this._testEventsSubscription.unsubscribe();
      this._testEventsSubscription = null;
    }
  }

  ngOnDestroy(): void {
    this._cleanupSubscriptions();
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

    const metrics = this.metricsData();
    if (!metrics?.endpoints?.length) {
      const emptyData = { data: [], labels: [] };
      urlCache.set(cacheKey, emptyData);
      return emptyData;
    }

    const endpointMetrics = metrics.endpoints.filter((m) => m.url === url);

    let data: number[] | { [seriesName: string]: number[] } = [];

    switch (metricType) {
      case 'peak_throughput':
        data = endpointMetrics.map((m) => m.metric?.peakRequestsPerSecond || 0);
        break;
      case 'average_throughput':
        data = endpointMetrics.map(
          (m) => m.metric?.averageRequestsPerSecond || 0,
        );
        break;
      case 'latency':
        data = endpointMetrics.map((m) => m.metric?.p50LatencyMs || 0);
        break;
      case 'latency_p95':
        data = endpointMetrics.map((m) => m.metric?.p95LatencyMs || 0);
        break;
      case 'latency_p99':
        data = endpointMetrics.map((m) => m.metric?.p99LatencyMs || 0);
        break;
      case 'error_rate':
        data = endpointMetrics.map((m) => (m.metric?.errorRate || 0) * 100);
        break;
      case 'success_rate':
        data = endpointMetrics.map(
          (m) =>
            ((m.metric?.successfulRequests || 0) /
              (m.metric?.totalRequests || 1)) *
            100,
        );
        break;
      case 'failed_requests':
        data = endpointMetrics.map((m) => m.metric?.failedRequests || 0);
        break;
      case 'network_throughput':
        data = endpointMetrics.map((m) => m.metric?.networkBytesPerSec || 0);
        break;
      case 'network_bytes_sent':
        data = endpointMetrics.map((m) => m.metric?.networkBytesSent || 0);
        break;
      case 'network_bytes_received':
        data = endpointMetrics.map((m) => m.metric?.networkBytesReceived || 0);
        break;
      // Note: cpu_usage and memory_usage NOT available per-endpoint
    }

    const labels = endpointMetrics.map((m) => m.epoch);

    const chartData = { data, labels };
    urlCache.set(cacheKey, chartData);
    return chartData;
  }

  sanitizeForChartId(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Handle endpoint selection change from direct value
   */
  onEndpointChangeValue(value: string): void {
    this.selectedEndpoint.set(value);
    // Close dropdown by blurring active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  deleteTest(): void {
    this.showDeleteModal.set(true);
  }

  async handleDeleteConfirm(): Promise<void> {
    const testId = this.testId();
    if (!testId) return;

    this.isDeleting.set(true);

    try {
      await this._testService.deleteTest(testId);
      this._logService.info('Test deleted successfully', { testId });
      this.appRouter.toHome();
    } catch (error) {
      this._logService.error('Failed to delete test', error);
    } finally {
      this.isDeleting.set(false);
      this.showDeleteModal.set(false);
    }
  }

  handleDeleteCancel(): void {
    this.showDeleteModal.set(false);
  }

  private _getGlobalChartData(metricType: ChartType): ChartData {
    const metrics = this.metricsData();
    if (!metrics?.global?.length) return { data: [], labels: [] };

    switch (metricType) {
      case 'peak_throughput':
        return {
          data: metrics.global.map((m) => m.metric?.peakRequestsPerSecond || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'average_throughput':
        return {
          data: metrics.global.map(
            (m) => m.metric?.averageRequestsPerSecond || 0,
          ),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'latency':
        return {
          data: metrics.global.map((m) => m.metric?.p50LatencyMs || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'latency_p95':
        return {
          data: metrics.global.map((m) => m.metric?.p95LatencyMs || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'latency_p99':
        return {
          data: metrics.global.map((m) => m.metric?.p99LatencyMs || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'error_rate':
        return {
          data: metrics.global.map((m) => (m.metric?.errorRate || 0) * 100),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'success_rate':
        return {
          data: metrics.global.map(
            (m) =>
              ((m.metric?.successfulRequests || 0) /
                (m.metric?.totalRequests || 1)) *
              100,
          ),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'failed_requests':
        return {
          data: metrics.global.map((m) => m.metric?.failedRequests || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'network_throughput':
        return {
          data: metrics.global.map((m) => m.metric?.networkBytesPerSec || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'network_bytes_sent':
        return {
          data: metrics.global.map((m) => m.metric?.networkBytesSent || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'network_bytes_received':
        return {
          data: metrics.global.map((m) => m.metric?.networkBytesReceived || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      default:
        return { data: [], labels: [] };
    }
  }

  async exportResults(format: 'json' | 'xlsx' | 'md'): Promise<void> {
    const testId = this.testId();
    if (!testId) {
      this._logService.warn('No test ID available for export');
      return;
    }

    try {
      await this._testExportService.exportTest(testId, format);
    } catch (error) {
      this._logService.error('Export failed', error);
    }
  }

  // New helper methods for enhanced UI
  getYAxisLabel(): string {
    const selected = this.selectedChartType();
    if (selected.includes('throughput')) return 'Req/sec';
    if (selected.includes('latency')) return 'ms';
    if (selected.includes('rate')) return '%';
    if (selected.includes('network_throughput')) return 'Bytes/sec';
    if (selected.includes('network_bytes')) return 'Bytes';
    if (selected === 'failed_requests') return 'requests';
    return 'Value';
  }

  getChartId(): string {
    const endpoint = this.selectedEndpoint();
    const chartType = this.selectedChartType();

    if (endpoint === 'global') {
      return `global-${chartType}`;
    } else {
      return `endpoint-${this.sanitizeForChartId(endpoint)}-${chartType}`;
    }
  }
}
