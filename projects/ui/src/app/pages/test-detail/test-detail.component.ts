import { Component, effect, inject, input, signal } from '@angular/core';
import {
  CHART_OPTIONS,
  POLLING_OPTIONS,
  TestDetailResolvedData,
} from '@tressi/shared/ui';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { DeleteConfirmationModalComponent } from '../../components/delete-confirmation-modal/delete-confirmation-modal.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { TestService } from '../../services/test.service';
import { TestDetailService } from './test-detail.service';
import { HeroStatsComponent } from './ui/hero-stats/hero-stats.component';
import { LatencyDistributionComponent } from './ui/latency-distribution/latency-distribution.component';
import { MetadataComponent } from './ui/metadata/metadata.component';
import { PerformanceOverTimeComponent } from './ui/performance-over-time/performance-over-time.component';
import { PerformanceSummaryComponent } from './ui/performance-summary/performance-summary.component';
import { ResponseSamplesComponent } from './ui/response-samples/response-samples.component';

@Component({
  selector: 'app-test-detail',
  imports: [
    HeaderComponent,
    IconComponent,
    DeleteConfirmationModalComponent,
    ButtonComponent,
    PerformanceSummaryComponent,
    PerformanceOverTimeComponent,
    HeroStatsComponent,
    MetadataComponent,
    LatencyDistributionComponent,
    ResponseSamplesComponent,
    StatusBadgeComponent,
  ],
  providers: [TestDetailService],
  templateUrl: './test-detail.component.html',
})
export class TestDetailComponent {
  readonly appRouter = inject(AppRouterService);
  readonly service = inject(TestDetailService);

  readonly data = input.required<TestDetailResolvedData>();
  readonly testId = input<string>();
  private readonly _testService = inject(TestService);
  private readonly _logService = inject(LogService);

  // UI State Signals
  readonly isDeleting = signal(false);
  readonly showDeleteModal = signal(false);
  readonly chartOptions = CHART_OPTIONS;
  readonly pollingOptions = POLLING_OPTIONS;

  // Collapsible state
  readonly configCollapsed = signal(true);
  readonly performanceSummaryCollapsed = signal(false);
  readonly performanceOverTimeCollapsed = signal(false);
  readonly latencyDistributionCollapsed = signal(false);
  readonly responseSamplesCollapsed = signal(false);

  constructor() {
    // Initialize from resolved data
    effect(() => {
      const resolvedData = this.data();
      if (resolvedData) {
        this.service.initialize(resolvedData);
      }
    });

    // Effect to handle polling interval changes
    effect(() => {
      const interval = this.service.selectedPollingInterval();
      const isRunning = this.service.isRealTime();

      if (!isRunning && interval !== 0) {
        this.service.selectedPollingInterval.set(0);
        return;
      }

      if (isRunning && interval === 0) {
        this.service.selectedPollingInterval.set(5000);
        return;
      }

      this.service.setupPolling(interval);
    });
  }

  sanitizeForChartId(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Handle endpoint selection change from direct value
   */
  onEndpointChangeValue(value: string): void {
    this.service.selectedEndpoint.set(value);
    // Close dropdown by blurring active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  deleteTest(): void {
    this.showDeleteModal.set(true);
  }

  async handleDeleteConfirm(): Promise<void> {
    const testId = this.service.testId();
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

  // New helper methods for enhanced UI
  getYAxisLabel(): string {
    const selected = this.service.selectedChartType();
    if (selected.includes('throughput')) return 'Req/sec';
    if (selected.includes('latency')) return 'ms';
    if (selected.includes('rate') || selected === 'target_achieved') return '%';
    if (selected.includes('network_throughput')) return 'Bytes/sec';
    if (selected.includes('network_bytes')) return 'Bytes';
    if (selected === 'failed_requests') return 'requests';
    return 'Value';
  }

  getChartId(): string {
    const endpoint = this.service.selectedEndpoint();
    const chartType = this.service.selectedChartType();

    if (endpoint === 'global') {
      return `global-${chartType}`;
    } else {
      return `endpoint-${this.sanitizeForChartId(endpoint)}-${chartType}`;
    }
  }
}
