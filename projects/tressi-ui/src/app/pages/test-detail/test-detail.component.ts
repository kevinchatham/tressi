import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { CollapsibleCardComponent } from '../../components/collapsible-card/collapsible-card.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { JsonTextareaComponent } from '../../components/json-textarea/json-textarea.component';
import { LineChartComponent } from '../../components/line-chart/line-chart.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { ConfigService } from '../../services/config.service';
import { EventService, TestEventData } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import {
  type ConfigDocument,
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
} from '../../types/chart.types';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';
import { MetricsSummaryComponent } from './metrics-summary/metrics-summary.component';
import { EndpointChartDataCache } from './test-detail.types';

@Component({
  selector: 'app-test-detail',
  imports: [
    CommonModule,
    LineChartComponent,
    HeaderComponent,
    IconComponent,
    CollapsibleCardComponent,
    StatusBadgeComponent,
    DeleteConfirmationModalComponent,
    MetricsSummaryComponent,
    JsonTextareaComponent,
    ButtonComponent,
  ],
  templateUrl: './test-detail.component.html',
})
export class TestDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly testService = inject(TestService);
  private readonly loadingService = inject(LoadingService);
  private readonly logService = inject(LogService);
  private readonly configService = inject(ConfigService);
  private readonly eventService = inject(EventService);
  private readonly testExportService = inject(TestExportService);

  // Signals - moved from TestDetailService
  readonly test = signal<TestDocument | null>(null);
  readonly metrics = signal<TestMetrics | null>(null);
  readonly selectedEndpoint = signal<string>('global');

  // Computed signals - moved from TestDetailService
  readonly selectedSummary = computed(() => {
    const test = this.test();
    if (!test?.summary) return null;

    const isGlobal = this.selectedEndpoint() === 'global';
    if (isGlobal) {
      return test.summary.global;
    } else {
      const endpointUrl = this.selectedEndpoint();
      return test.summary.endpoints?.find((e) => e.url === endpointUrl) || null;
    }
  });

  // Component signals
  readonly testId = signal<string | null>(null);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly isDeleting = signal(false);
  readonly showDeleteModal = signal(false);
  readonly selectedChartType = signal<ChartType>(DEFAULT_CHART_TYPE);
  readonly chartOptions = CHART_OPTIONS;

  // Config signals
  readonly config = signal<ConfigDocument | null>(null);
  readonly configLoading = signal<boolean>(false);
  readonly configError = signal<string>('');

  // Collapsible state
  readonly testInfoCollapsed = signal(true);
  readonly configCollapsed = signal(true);
  readonly performanceSummaryCollapsed = signal(false);
  readonly performanceOverTimeCollapsed = signal(false);

  // Computed signals for component
  readonly testData = computed(() => this.test());
  readonly metricsData = computed(() => this.metrics());
  readonly isRealTime = computed(() => this.testData()?.status === 'running');

  // Global test time range for all charts
  readonly testTimeRange = computed(() => {
    const test = this.testData();
    if (!test?.summary?.global) {
      return null;
    }

    const range = {
      min: test.summary.global.epochStartedAt,
      max: test.summary.global.epochEndedAt,
    };
    return range;
  });

  readonly displayConfigName = computed(() => {
    const config = this.config();
    return config?.name || 'Unknown Configuration';
  });

  // Cache for endpoint chart data
  private readonly cachedEndpointChartData: EndpointChartDataCache = new Map();

  // Private state for subscriptions - moved from TestDetailService
  private metricsStreamSubscription: Subscription | null = null;
  private testEventsSubscription: Subscription | null = null;

  constructor() {
    // Subscribe to route params to ensure we get the testId
    this.route.params.subscribe((params) => {
      const id = params['testId'] || null;
      this.testId.set(id);
      this.loadTestDetails(id);
    });

    // Set up real-time updates after we have a test ID
    this.setupRealTimeUpdates();
  }

  async loadTestDetails(testId: string | null): Promise<void> {
    if (!testId) return;

    this.loadingService.setPageLoading('test-detail', true);
    this.hasError.set(false);
    this.errorMessage.set('');

    try {
      // Moved from TestDetailService - direct data loading
      const [testResult, metricsResult] = await Promise.all([
        this.testService.getTestById(testId),
        this.testService.getTestMetrics(testId),
      ]);

      this.test.set(testResult);
      this.metrics.set(metricsResult);

      // Load config after test data is loaded
      if (testResult?.configId) {
        await this.loadConfig(testResult.configId);
      }
    } catch (error) {
      this.hasError.set(true);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to load test details',
      );
      this.logService.error('Failed to load test details', error);
    } finally {
      this.loadingService.setPageLoading('test-detail', false);
    }
  }

  async loadConfig(configId: string | undefined): Promise<void> {
    if (!configId) return;

    this.configLoading.set(true);
    this.configError.set('');
    this.loadingService.setPageLoading('test-detail-config', true);

    try {
      const configData = await this.configService.getOne(configId);
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
      this.logService.error('Failed to load configuration', error);
    } finally {
      this.configLoading.set(false);
      this.loadingService.setPageLoading('test-detail-config', false);
    }
  }

  private setupRealTimeUpdates(): void {
    // Start real-time updates when test ID is available
    const testId = this.testId();
    if (testId) {
      this.startRealTimeUpdates(testId);
    }
  }

  // Moved from TestDetailService - real-time subscription management
  startRealTimeUpdates(testId: string | null): void {
    if (!testId) return;

    // Clean up existing subscriptions
    this.cleanupSubscriptions();

    // Subscribe to metrics stream for real-time updates
    this.metricsStreamSubscription = this.eventService
      .getMetricsStream()
      .subscribe({
        next: (data) => {
          if (data.testId === testId) {
            this.mergeRealTimeMetrics(data.testSummary);
          }
        },
        error: (error: unknown) => {
          this.logService.error('Real-time metrics error:', error);
        },
      });

    // Subscribe to test events for completion/failure notifications
    this.testEventsSubscription = this.eventService
      .getTestEventsStream()
      .subscribe({
        next: (event: TestEventData) => {
          if (event.testId === testId) {
            this.handleTestEvent(event);
          }
        },
        error: (error: unknown) => {
          this.logService.error('Test events error:', error);
        },
      });
  }

  private mergeRealTimeMetrics(testSummary: TestSummary): void {
    const currentTest = this.test();
    if (!currentTest) return;

    // Update the test summary with real-time data
    this.test.set({
      ...currentTest,
      summary: testSummary,
    });
  }

  private handleTestEvent(event: TestEventData): void {
    const currentTest = this.test();
    if (!currentTest || currentTest.id !== event.testId) return;

    // Update test status
    this.test.set({
      ...currentTest,
      status: event.status,
    });

    // Stop real-time updates when test completes
    if (event.status === 'completed' || event.status === 'failed') {
      this.cleanupSubscriptions();
    }
  }

  private cleanupSubscriptions(): void {
    if (this.metricsStreamSubscription) {
      this.metricsStreamSubscription.unsubscribe();
      this.metricsStreamSubscription = null;
    }

    if (this.testEventsSubscription) {
      this.testEventsSubscription.unsubscribe();
      this.testEventsSubscription = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
  }

  getCachedEndpointChartData(url: string, metricType: ChartType): ChartData {
    const cacheKey = `${url}-${metricType}`;

    if (!this.cachedEndpointChartData.has(url)) {
      this.cachedEndpointChartData.set(url, new Map());
    }

    const urlCache = this.cachedEndpointChartData.get(url)!;

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

    let data: number[] = [];

    switch (metricType) {
      case 'peak_throughput':
        data = endpointMetrics.map((m) => m.metric?.peakRequestsPerSecond);
        break;
      case 'average_throughput':
        data = endpointMetrics.map(
          (m) => m.metric?.averageRequestsPerSecond || 0,
        );
        break;
      case 'latency':
        data = endpointMetrics.map((m) => m.metric?.p50LatencyMs || 0);
        break;
    }

    const labels = endpointMetrics.map((m) => m.epoch);

    const chartData = { data, labels };
    urlCache.set(cacheKey, chartData);
    return chartData;
  }

  sanitizeForChartId(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_');
  }

  deleteTest(): void {
    this.showDeleteModal.set(true);
  }

  async handleDeleteConfirm(): Promise<void> {
    const testId = this.testId();
    if (!testId) return;

    this.isDeleting.set(true);
    this.loadingService.setPageLoading('test-detail-delete', true);

    try {
      await this.testService.deleteTest(testId);
      this.logService.info('Test deleted successfully', { testId });
      this.router.navigate(['/']);
    } catch (error) {
      this.logService.error('Failed to delete test', error);
    } finally {
      this.isDeleting.set(false);
      this.loadingService.setPageLoading('test-detail-delete', false);
      this.showDeleteModal.set(false);
    }
  }

  handleDeleteCancel(): void {
    this.showDeleteModal.set(false);
  }

  onChartTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value as ChartType;
    this.selectedChartType.set(value);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  onEndpointChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.selectedEndpoint.set(value);
  }

  // Get current chart data based on selected endpoint
  getCurrentChartData(): ChartData {
    const endpoint = this.selectedEndpoint();
    if (endpoint === 'global') {
      return this.getGlobalChartData(this.selectedChartType());
    } else {
      return this.getCachedEndpointChartData(
        endpoint,
        this.selectedChartType(),
      );
    }
  }

  private getGlobalChartData(metricType: ChartType): ChartData {
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
    }
  }

  async exportResults(format: 'json' | 'xlsx' | 'md'): Promise<void> {
    const testId = this.testId();
    if (!testId) {
      this.logService.warn('No test ID available for export');
      return;
    }

    try {
      await this.testExportService.exportTest(testId, format);
    } catch (error) {
      this.logService.error('Export failed', error);
    }
  }

  // New helper methods for enhanced UI
  getYAxisLabel(): string {
    const selected = this.selectedChartType();
    return selected.includes('throughput') ? 'Req/sec' : 'ms';
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

  getChartStats(): {
    min: number;
    avg: number;
    max: number;
  } {
    const data = this.getCurrentChartData().data;
    if (data.length === 0) {
      return { min: 0, avg: 0, max: 0 };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const avg = data.reduce((sum, val) => sum + val, 0) / data.length;

    return {
      min: Math.round(min * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  }

  // Helper methods from test-info-card component
  formatDate(epoch: number | null | undefined): string {
    if (!epoch) return 'N/A';
    return new Date(epoch).toLocaleString();
  }

  formatDuration(): string {
    const test = this.testData();
    if (!test) return 'N/A';
    if (test.status === 'running') {
      return 'Running...';
    }
    // Use embedded summary fields first
    if (
      test.summary?.global.epochEndedAt &&
      test.summary?.global.epochStartedAt
    ) {
      const duration =
        test.summary.global.epochEndedAt - test.summary.global.epochStartedAt;
      return `${Math.round(duration / 1000)}s`;
    }
    return test.summary?.global?.finalDurationSec
      ? `${test.summary.global.finalDurationSec}s`
      : 'N/A';
  }
}
