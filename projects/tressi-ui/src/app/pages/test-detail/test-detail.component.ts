import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import type { TestSummary } from '@tressi-cli/reporting/types';
import { Subscription } from 'rxjs';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent, IconName } from '../../components/icon/icon.component';
import { LineChartComponent } from '../../components/line-chart/line-chart.component';
import { ConfigService } from '../../services/config.service';
import { EventService } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import type {
  EndpointMetric,
  TestDocument,
  TestMetrics,
} from '../../services/rpc.service';
import { TestService } from '../../services/test.service';

interface ChartData {
  data: number[];
  labels: number[];
}

interface EndpointMetrics {
  url: string;
  metrics: EndpointMetric[];
  summary: {
    avgThroughput: number;
    avgLatency: number;
    avgErrorRate: number;
  };
}

@Component({
  selector: 'app-test-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    LineChartComponent,
    HeaderComponent,
  ],
  templateUrl: './test-detail.component.html',
})
export class TestDetailComponent implements OnDestroy, OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly testService = inject(TestService);
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly eventService = inject(EventService);
  private readonly loadingService = inject(LoadingService);

  // Signals for reactive state management
  private readonly test = signal<TestDocument | null>(null);
  private readonly metrics = signal<TestMetrics | null>(null);
  private readonly configName = signal<string>('');
  private readonly error = signal<string | null>(null);
  private readonly activeTab = signal<'global' | 'endpoints'>('global');
  private readonly isRealTime = signal<boolean>(false);
  private readonly realTimeMetrics = signal<TestSummary[]>([]);
  private eventSubscription: Subscription | null = null;

  // Collapsible state signals
  readonly testInfoCollapsed = signal(false);
  readonly globalSummaryCollapsed = signal(true);
  readonly endpointSummaryCollapsed = signal(true);

  // Animation state signals
  readonly globalTabFadingIn = signal(false);
  readonly endpointsTabFadingIn = signal(false);

  readonly hasError = computed(() => this.error() !== null);
  readonly errorMessage = computed(() => this.error());
  readonly testData = computed(() => this.test());
  readonly metricsData = computed(() => this.metrics());
  readonly activeTabName = computed(() => this.activeTab());

  // Chart data computed signals
  readonly throughputChartData = computed(() =>
    this.buildChartData('throughput'),
  );
  readonly latencyChartData = computed(() => this.buildChartData('latency'));
  readonly errorRateChartData = computed(() =>
    this.buildChartData('errorRate'),
  );

  // Endpoint data computed signals
  readonly endpointUrls = computed(() => {
    const metrics = this.metrics();
    if (!metrics) return [];
    return [...new Set(metrics.endpoints.map((e) => e.url))];
  });

  readonly endpointMetrics = computed(() => this.groupEndpointMetrics());
  readonly displayConfigName = computed(() => this.configName());

  // Endpoint summary computed signal
  readonly endpointSummary = computed(() => this.calculateEndpointSummary());

  // Cache for endpoint chart data
  private readonly cachedEndpointChartData = new Map<
    string,
    {
      throughput: ChartData;
      latency: ChartData;
      errorRate: ChartData;
    }
  >();

  ngOnInit(): void {
    this.loadingService.registerPage('test-detail');
    this.loadTestDetails();
  }

  async loadTestDetails(): Promise<void> {
    try {
      this.loadingService.setPageLoading('test-detail', true);
      this.error.set(null);

      const testId = this.route.snapshot.paramMap.get('testId');
      if (!testId) {
        this.error.set('Test ID is required');
        return;
      }

      // Load test and metrics in parallel
      const [test, metrics] = await Promise.all([
        this.testService.getTestById(testId),
        this.testService.getTestMetrics(testId),
      ]);

      this.test.set(test);
      this.metrics.set(metrics);

      // Pre-cache endpoint chart data
      this.preCacheEndpointChartData();

      // Load config name for display
      if (test.configId) {
        const config = await this.configService.getOne(test.configId);
        this.configName.set(config?.name || '[Deleted Configuration]');
      }

      // Detect if test is running and set up real-time updates
      if (test.status === 'running') {
        this.isRealTime.set(true);
        this.setupRealTimeUpdates();
      } else {
        this.isRealTime.set(false);
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load test details',
      );
    } finally {
      this.loadingService.setPageLoading('test-detail', false);
    }
  }

  private preCacheEndpointChartData(): void {
    const metrics = this.metrics();
    if (!metrics) return;

    const endpoints = this.groupEndpointMetrics();
    this.cachedEndpointChartData.clear(); // Clear existing cache

    endpoints.forEach((endpoint) => {
      const cacheKey = this.sanitizeForChartId(endpoint.url);
      this.cachedEndpointChartData.set(cacheKey, {
        throughput: this.getEndpointChartData(endpoint, 'throughput'),
        latency: this.getEndpointChartData(endpoint, 'latency'),
        errorRate: this.getEndpointChartData(endpoint, 'errorRate'),
      });
    });
  }

  private setupRealTimeUpdates(): void {
    this.eventSubscription = this.eventService.getMetricsStream().subscribe({
      next: (testSummary) => {
        this.realTimeMetrics.update((history) => [...history, testSummary]);
        // Update chart data with new metrics
        this.updateChartsWithRealTimeData(testSummary);
      },
      error: (error) => {
        // eslint-disable-next-line no-console
        console.error('Event stream connection error:', error);
        this.isRealTime.set(false);
      },
    });
  }

  private updateChartsWithRealTimeData(testSummary: TestSummary): void {
    // For now, we'll just log the real-time data
    // In a future enhancement, we could merge this with historical data
    this.logService.info('Real-time test summary received:', testSummary);
  }

  ngOnDestroy(): void {
    // Clean up event subscription
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
    this.cachedEndpointChartData.clear(); // Clear cache on destroy
  }

  /**
   * Navigate back to dashboard
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Set active tab with animation
   */
  setActiveTab(tab: 'global' | 'endpoints'): void {
    this.activeTab.set(tab);

    // Trigger fade-in animation
    if (tab === 'global') {
      this.globalTabFadingIn.set(true);
      this.endpointsTabFadingIn.set(false);
      // Reset after animation completes
      setTimeout(() => this.globalTabFadingIn.set(false), 300);
    } else {
      this.endpointsTabFadingIn.set(true);
      this.globalTabFadingIn.set(false);
      // Reset after animation completes
      setTimeout(() => this.endpointsTabFadingIn.set(false), 300);
    }
  }

  /**
   * Delete test with confirmation
   */
  async deleteTest(): Promise<void> {
    const test = this.test();
    if (!test) return;

    const confirmed = confirm(
      `Are you sure you want to delete this test?\n\n` +
        `Test ID: ${test.id}\n` +
        `Status: ${test.status}\n` +
        `This will also delete all associated metrics data.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      this.loadingService.setPageLoading('test-detail', true);
      const result = await this.testService.deleteTest(test.id);

      if (result.success) {
        this.logService.info(`Test ${test.id} deleted successfully`);
        // Navigate back to test list
        this.goBack();
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to delete test',
      );
    } finally {
      this.loadingService.setPageLoading('test-detail', false);
    }
  }

  /**
   * Build chart data for a specific metric type
   */
  buildChartData(
    metricType: 'throughput' | 'latency' | 'errorRate',
  ): ChartData {
    const metrics = this.metrics();
    if (!metrics || !metrics.global.length) {
      return { data: [], labels: [] };
    }

    const labels = metrics.global.map((m) => m.epoch);
    const data = metrics.global.map((m) => {
      switch (metricType) {
        case 'throughput':
          return m.metric.requestsPerSecond;
        case 'latency':
          return m.metric.averageLatency;
        case 'errorRate':
          return m.metric.errorRate;
        default:
          return 0;
      }
    });

    return { data, labels };
  }

  /**
   * Group endpoint metrics by URL
   */
  groupEndpointMetrics(): EndpointMetrics[] {
    const metrics = this.metrics();
    if (!metrics) return [];

    const grouped = new Map<string, EndpointMetric[]>();

    metrics.endpoints.forEach((endpoint) => {
      if (!grouped.has(endpoint.url)) {
        grouped.set(endpoint.url, []);
      }
      grouped.get(endpoint.url)!.push(endpoint);
    });

    return Array.from(grouped.entries()).map(([url, endpoints]) => {
      const metrics = endpoints.map((e) => e.metric);
      const avgThroughput =
        metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0) /
          metrics.length || 0;
      const avgLatency =
        metrics.reduce((sum, m) => sum + m.averageLatency, 0) /
          metrics.length || 0;
      const avgErrorRate =
        metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length || 0;

      return {
        url,
        metrics: endpoints,
        summary: {
          avgThroughput,
          avgLatency,
          avgErrorRate,
        },
      };
    });
  }

  /**
   * Get endpoint chart data (for caching purposes)
   */
  getEndpointChartData(
    endpoint: EndpointMetrics,
    metricType: 'throughput' | 'latency' | 'errorRate',
  ): ChartData {
    const labels = endpoint.metrics.map((m) => m.epoch);
    const data = endpoint.metrics.map((m) => {
      switch (metricType) {
        case 'throughput':
          return m.metric.requestsPerSecond;
        case 'latency':
          return m.metric.averageLatency;
        case 'errorRate':
          return m.metric.errorRate;
        default:
          return 0;
      }
    });

    return { data, labels };
  }

  /**
   * Calculate aggregated endpoint summary statistics
   */
  calculateEndpointSummary(): {
    totalEndpoints: number;
    avgThroughput: number;
    avgLatency: number;
    avgErrorRate: number;
    totalDataPoints: number;
  } {
    const endpoints = this.endpointMetrics();
    if (!endpoints.length) {
      return {
        totalEndpoints: 0,
        avgThroughput: 0,
        avgLatency: 0,
        avgErrorRate: 0,
        totalDataPoints: 0,
      };
    }

    const totalEndpoints = endpoints.length;
    const totalDataPoints = endpoints.reduce(
      (sum, endpoint) => sum + endpoint.metrics.length,
      0,
    );

    const avgThroughput =
      endpoints.reduce(
        (sum, endpoint) => sum + endpoint.summary.avgThroughput,
        0,
      ) / totalEndpoints;
    const avgLatency =
      endpoints.reduce(
        (sum, endpoint) => sum + endpoint.summary.avgLatency,
        0,
      ) / totalEndpoints;
    const avgErrorRate =
      endpoints.reduce(
        (sum, endpoint) => sum + endpoint.summary.avgErrorRate,
        0,
      ) / totalEndpoints;

    return {
      totalEndpoints,
      avgThroughput,
      avgLatency,
      avgErrorRate,
      totalDataPoints,
    };
  }

  /**
   * Get cached endpoint chart data
   */
  getCachedEndpointChartData(
    url: string,
    metricType: 'throughput' | 'latency' | 'errorRate',
  ): ChartData {
    const cacheKey = this.sanitizeForChartId(url);
    return (
      this.cachedEndpointChartData.get(cacheKey)?.[metricType] || {
        data: [],
        labels: [],
      }
    );
  }

  /**
   * Sanitize endpoint URL for use as chart ID
   * Replaces special characters with hyphens and ensures valid HTML element ID
   */
  sanitizeForChartId(url: string): string {
    return url
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace all non-alphanumeric characters with hyphens
      .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading and trailing hyphens
      .toLowerCase() // Convert to lowercase for consistency
      .substring(0, 50); // Limit length to prevent excessively long IDs
  }

  /**
   * Calculate average for a specific metric type
   */
  calculateAverage(metricType: 'throughput' | 'latency' | 'errorRate'): string {
    const metrics = this.metrics();
    if (!metrics || !metrics.global.length) {
      return '0';
    }

    const values = metrics.global.map((m) => {
      switch (metricType) {
        case 'throughput':
          return m.metric.requestsPerSecond;
        case 'latency':
          return m.metric.averageLatency;
        case 'errorRate':
          return m.metric.errorRate;
        default:
          return 0;
      }
    });

    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    return average.toFixed(2);
  }

  /**
   * Get test duration
   */
  getTestDuration(): string {
    const test = this.test();
    if (!test) return 'N/A';
    return this.testService.formatDuration(
      this.testService.getTestDuration(test),
    );
  }

  /**
   * Get status color class
   */
  getStatusColor(status: TestDocument['status']): string {
    return this.testService.getStatusColor(status);
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: TestDocument['status']): IconName {
    switch (status) {
      case 'running':
        return 'rocket';
      case 'completed':
        return 'select';
      case 'failed':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Format date
   */
  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Format duration from timestamps
   */
  formatDuration(start: number, end?: number): string {
    const duration = (end || Date.now()) - start;
    return this.testService.formatDuration(duration);
  }

  /**
   * Toggle test information collapse state
   */
  toggleTestInfo(): void {
    this.testInfoCollapsed.update((value) => !value);
  }

  /**
   * Toggle global summary collapse state
   */
  toggleGlobalSummary(): void {
    this.globalSummaryCollapsed.update((value) => !value);
  }

  /**
   * Toggle endpoint summary collapse state
   */
  toggleEndpointSummary(): void {
    this.endpointSummaryCollapsed.update((value) => !value);
  }
}
