import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { LineChartComponent } from '../../components/line-chart/line-chart.component';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import { type TestDocument } from '../../services/rpc.service';
import { TestService } from '../../services/test.service';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';
import { EndpointFilterComponent } from './endpoint-filter/endpoint-filter.component';
import { TestDetailService } from './test-detail.service';
import { ChartData, EndpointChartDataCache } from './test-detail.types';
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
    EndpointFilterComponent,
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

  // Signals
  readonly testId = signal<string | null>(null);
  readonly activeTabName = signal<'global' | 'endpoints'>('global');
  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly isDeleting = signal(false);
  readonly showDeleteModal = signal(false);

  // Collapsible state
  readonly testInfoCollapsed = signal(true);

  // Animation state
  readonly globalTabFadingIn = signal(false);
  readonly endpointsTabFadingIn = signal(false);

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

    const data = metrics.global.map((m) => m.metric?.errorRate || 0);
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

  setActiveTab(tab: 'global' | 'endpoints'): void {
    if (this.activeTabName() === tab) return;

    this.activeTabName.set(tab);

    // Handle fade animation
    if (tab === 'global') {
      this.globalTabFadingIn.set(true);
      setTimeout(() => this.globalTabFadingIn.set(false), 300);
    } else {
      this.endpointsTabFadingIn.set(true);
      setTimeout(() => this.endpointsTabFadingIn.set(false), 300);
    }
  }

  getCachedEndpointChartData(url: string, metricType: string): ChartData {
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
        data = endpointMetrics.map((m) => m.metric?.errorRate || 0);
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

  goBack(): void {
    this.router.navigate(['/']);
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
