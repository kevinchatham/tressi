import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { LineChartComponent } from '../../components/line-chart/line-chart.component';
import { LoadingService } from '../../services/loading.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { type TestDocument } from '../../services/rpc.service';
import { TestService } from '../../services/test.service';
import { CHART_OPTIONS, ChartData, ChartType } from '../../types/chart.types';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';
import { TestDetailService } from './test-detail.service';
import { EndpointChartDataCache } from './test-detail.types';
import { TestDetailExportService } from './test-detail-export.service';
import { TestInfoCardComponent } from './test-info-card/test-info-card.component';

@Component({
  selector: 'app-test-detail',
  standalone: true,
  imports: [
    CommonModule,
    LineChartComponent,
    HeaderComponent,
    IconComponent,
    TestInfoCardComponent,
    DeleteConfirmationModalComponent,
  ],
  templateUrl: './test-detail.component.html',
})
export class TestDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly testService = inject(TestService);
  private readonly loadingService = inject(LoadingService);
  private readonly logService = inject(LogService);
  private readonly testDetailService = inject(TestDetailService);
  private readonly exportService = inject(TestDetailExportService);
  private readonly localStorageService = inject(LocalStorageService);

  // Signals
  readonly testId = signal<string | null>(null);
  readonly selectedEndpoint = signal<string>('global');
  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly isDeleting = signal(false);
  readonly showDeleteModal = signal(false);
  readonly selectedChartType = signal<ChartType>('throughput');
  readonly chartOptions = CHART_OPTIONS;

  // Collapsible state
  readonly testInfoCollapsed = signal(true);

  // Computed signals
  readonly testData = computed(() => this.testDetailService.test());
  readonly metricsData = computed(() => this.testDetailService.metrics());
  readonly isRealTime = computed(() => this.testData()?.status === 'running');

  readonly endpointSummaries = computed(() => {
    const test = this.testData();
    return (
      test?.summary?.endpoints?.map((endpoint) => ({
        url: endpoint.url,
        method: endpoint.method,
        avgThroughput: Math.round(endpoint.actualRps),
        avgLatency: Math.round(endpoint.avgLatencyMs),
        avgErrorRate: (endpoint.failedRequests / endpoint.totalRequests) * 100,
        totalRequests: endpoint.totalRequests,
        successfulRequests: endpoint.successfulRequests,
        failedRequests: endpoint.failedRequests,
      })) ?? []
    );
  });

  readonly endpointSummary = computed<TestDocument['summary']>(() => {
    return this.testData()?.summary ?? null;
  });

  readonly endpointUrls = computed(() => {
    return this.endpointSummaries().map((endpoint) => endpoint.url);
  });

  readonly throughputChartData = computed<ChartData>(() => {
    const metrics = this.metricsData();
    if (!metrics?.global?.length) return { data: [], labels: [] };

    const data = metrics.global.map((m) => m.metric?.requestsPerSecond || 0);
    const labels = metrics.global.map((m) => m.epoch);

    return { data, labels };
  });

  readonly latencyChartData = computed<ChartData>(() => {
    const metrics = this.metricsData();
    if (!metrics?.global?.length) return { data: [], labels: [] };

    const data = metrics.global.map((m) => m.metric?.averageLatency || 0);
    const labels = metrics.global.map((m) => m.epoch);
    return { data, labels };
  });

  readonly errorRateChartData = computed<ChartData>(() => {
    const metrics = this.metricsData();
    if (!metrics?.global?.length) return { data: [], labels: [] };

    const data = metrics.global.map((m) => m.metric?.errorPercentage || 0);
    const labels = metrics.global.map((m) => m.epoch);
    return { data, labels };
  });

  readonly displayConfigName = computed(() => {
    const test = this.testData();
    if (!test) return '';
    return test.configId; // Simplified for now
  });

  // Cache for endpoint chart data
  private readonly cachedEndpointChartData: EndpointChartDataCache = new Map();

  constructor() {
    // Load chart type preference from localStorage
    const preferences = this.localStorageService.getPreferences();
    this.selectedChartType.set(preferences.selectedChartType as ChartType);

    // Subscribe to route params to ensure we get the testId
    this.route.params.subscribe((params) => {
      const id = params['testId'] || null;
      this.testId.set(id);
      this.loadTestDetails(id);
    });

    // Set up real-time updates after we have a test ID
    this.setupRealTimeUpdates();

    // No need for effect - saving is handled in onChartTypeChange method
  }

  async loadTestDetails(testId: string | null): Promise<void> {
    if (!testId) return;

    this.loadingService.setPageLoading('test-detail', true);
    this.hasError.set(false);
    this.errorMessage.set('');

    try {
      await this.testDetailService.loadTestDetails(testId);
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

  private setupRealTimeUpdates(): void {
    // Start real-time updates when test ID is available
    const testId = this.testId();
    if (testId) {
      this.testDetailService.startRealTimeUpdates(testId);
    }
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
    let labels: number[] = [];

    switch (metricType) {
      case 'throughput':
        data = endpointMetrics.map((m) => m.metric?.requestsPerSecond || 0);
        labels = endpointMetrics.map((m) => m.epoch);
        break;
      case 'latency':
        data = endpointMetrics.map((m) => m.metric?.averageLatency || 0);
        labels = endpointMetrics.map((m) => m.epoch);
        break;
      case 'errorRate':
        data = endpointMetrics.map((m) => m.metric?.errorPercentage || 0);
        labels = endpointMetrics.map((m) => m.epoch);
        break;
    }

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

    // Save the preference to localStorage
    const currentPreferences = this.localStorageService.getPreferences();
    const newPreferences = {
      ...currentPreferences,
      selectedChartType: value,
    };
    this.localStorageService.savePreferences(newPreferences);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  // Helper methods for template type checking
  isThroughputChart(): boolean {
    return this.selectedChartType() === 'throughput';
  }

  isLatencyChart(): boolean {
    return this.selectedChartType() === 'latency';
  }

  isErrorRateChart(): boolean {
    return this.selectedChartType() === 'errorRate';
  }

  onEndpointChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedEndpoint.set(target.value);
  }

  getCurrentEndpointSummary() {
    const endpointUrl = this.selectedEndpoint();
    if (endpointUrl === 'global') return null;
    return this.endpointSummaries().find((e) => e.url === endpointUrl);
  }

  getCurrentSummaryStats() {
    const endpoint = this.selectedEndpoint();
    if (endpoint === 'global') {
      const test = this.testData();
      if (!test?.summary) return null;
      return {
        avgThroughput: Math.round(
          test.summary.global.totalRequests /
            (test.summary.global.actualDuration / 1000),
        ),
        avgLatency: Math.round(test.summary.global.avgLatencyMs),
        avgErrorRate:
          (test.summary.global.failedRequests /
            test.summary.global.totalRequests) *
          100,
        totalRequests: test.summary.global.totalRequests,
      };
    } else {
      return this.getCurrentEndpointSummary();
    }
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
      case 'throughput':
        return {
          data: metrics.global.map((m) => m.metric?.requestsPerSecond || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'latency':
        return {
          data: metrics.global.map((m) => m.metric?.averageLatency || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
      case 'errorRate':
        return {
          data: metrics.global.map((m) => m.metric?.errorPercentage || 0),
          labels: metrics.global.map((m) => m.epoch),
        };
    }
  }

  async exportResults(format: 'json' | 'csv' | 'xlsx'): Promise<void> {
    const test = this.testData();
    const metrics = this.metricsData();

    if (!test || !metrics) return;

    try {
      await this.exportService.export(test, metrics, format);
      this.logService.info('Test results exported', {
        testId: test.id,
        format,
      });
    } catch (error) {
      this.logService.error('Failed to export results', error);
    }
  }
}
