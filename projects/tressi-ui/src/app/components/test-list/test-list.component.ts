import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  OnChanges,
  OnDestroy,
  OnInit,
  signal,
  SimpleChanges,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AggregatedMetric } from '@tressi-cli/common/metrics';
import { Subscription } from 'rxjs';

import { IconComponent, IconName } from '../../components/icon/icon.component';
import { ConfigService } from '../../services/config.service';
import { EventService } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import type { TestDocument, TestSummary } from '../../services/rpc.service';
import { TestService } from '../../services/test.service';

@Component({
  selector: 'app-test-list',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './test-list.component.html',
})
export class TestListComponent implements OnChanges, OnInit, OnDestroy {
  configId = input.required<string>();

  private readonly router = inject(Router);
  private readonly testService = inject(TestService);
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly loadingService = inject(LoadingService);
  private readonly eventService = inject(EventService);

  // Signals for reactive state management
  private readonly tests = signal<TestDocument[]>([]);
  private readonly configName = signal<string>('');
  private readonly error = signal<string | null>(null);
  readonly showDeleteModal = signal<boolean>(false);
  readonly testToDelete = signal<TestDocument | null>(null);
  private readonly latestMetrics = signal<AggregatedMetric | null>(null);
  private readonly testSummaries = signal<Map<string, TestSummary>>(new Map());

  // Computed signals for derived state
  readonly displayedTests = computed(() => this.tests());
  readonly hasError = computed(() => this.error() !== null);
  readonly errorMessage = computed(() => this.error());
  readonly hasTests = computed(() => this.tests().length > 0);
  readonly pageTitle = computed(() => `Test History - ${this.configName()}`);

  private metricsSubscription?: Subscription;
  private testEventsSubscription?: Subscription;

  ngOnInit(): void {
    this.loadingService.registerPage('test-list');
    this.subscribeToMetrics();
    this.subscribeToTestEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['configId'] && changes['configId'].currentValue) {
      this.loadTests();
    }
  }

  async loadTests(): Promise<void> {
    try {
      this.loadingService.setPageLoading('test-list', true);
      this.error.set(null);

      // Load config name for display
      const config = await this.configService.getOne(this.configId());
      if (config) {
        this.configName.set(config.name);
      } else {
        this.configName.set('[Deleted Configuration]');
      }

      // Load tests for this config
      const tests = await this.testService.getTestsByConfigId(this.configId());
      this.tests.set(tests);

      // Load summaries for completed tests
      const completedTests = tests.filter(
        (t) => t.status === 'completed' || t.status === 'failed',
      );
      await Promise.allSettled(
        completedTests.map((test) => this.loadTestSummary(test.id)),
      );
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load tests',
      );
      this.tests.set([]);
    } finally {
      this.loadingService.setPageLoading('test-list', false);
    }
  }

  /**
   * Load summary for a test and cache it
   */
  private async loadTestSummary(testId: string): Promise<void> {
    try {
      const summary = await this.testService.getTestSummary(testId);
      this.testSummaries.update((map) => {
        const newMap = new Map(map);
        newMap.set(testId, summary);
        return newMap;
      });
    } catch (error) {
      this.logService.error(
        `Failed to load summary for test ${testId}:`,
        error,
      );
    }
  }

  /**
   * Navigate to test detail view
   */
  viewTestDetails(testId: string): void {
    this.router.navigate(['/tests', testId]);
  }

  /**
   * Show delete confirmation modal
   */
  showDeleteConfirm(test: TestDocument, event: Event): void {
    event.stopPropagation(); // Prevent row click
    this.testToDelete.set(test);
    this.showDeleteModal.set(true);
  }

  /**
   * Cancel delete operation
   */
  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.testToDelete.set(null);
  }

  /**
   * Delete a test with confirmation
   */
  async deleteTest(test: TestDocument, event: Event): Promise<void> {
    this.showDeleteConfirm(test, event);
  }

  /**
   * Confirm and execute test deletion
   */
  async deleteTestConfirmed(): Promise<void> {
    const test = this.testToDelete();
    if (!test) return;

    try {
      this.loadingService.setPageLoading('test-list', true);
      this.showDeleteModal.set(false);
      const result = await this.testService.deleteTest(test.id);

      if (result.success) {
        // Remove the test from the list
        this.tests.update((tests) => tests.filter((t) => t.id !== test.id));
        this.logService.info(`Test ${test.id} deleted successfully`);
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to delete test',
      );
    } finally {
      this.loadingService.setPageLoading('test-list', false);
      this.testToDelete.set(null);
    }
  }

  /**
   * Refresh the test list
   */
  async refreshTests(): Promise<void> {
    await this.loadTests();
  }

  /**
   * Get test duration as formatted string
   */
  getTestDuration(test: TestDocument): string {
    if (
      test.status === 'completed' &&
      test.epochStartedAt &&
      test.epochEndedAt
    ) {
      const duration = test.epochEndedAt - test.epochStartedAt;
      return this.testService.formatDuration(duration);
    }
    return this.testService.formatDuration(
      this.testService.getTestDuration(test),
    );
  }

  /**
   * Get status color class for styling
   */
  getStatusColor(status: TestDocument['status']): string {
    return this.testService.getStatusColor(status);
  }

  /**
   * Get status icon name
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
   * Get formatted date string
   */
  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Subscribe to real-time metrics updates
   */
  private subscribeToMetrics(): void {
    this.metricsSubscription = this.eventService.getMetricsStream().subscribe({
      next: (metric: AggregatedMetric) => {
        this.latestMetrics.set(metric);
        this.updateRunningTest(metric);
      },
      error: (error: Error) => {
        this.logService.error('Metrics stream error:', error);
        // Simple error logging since localhost SSE is reliable
      },
    });
  }

  /**
   * Subscribe to test events (started, completed, failed)
   */
  private subscribeToTestEvents(): void {
    this.testEventsSubscription = this.eventService
      .getTestEventsStream()
      .subscribe({
        next: (event) => {
          if (event.configId === this.configId()) {
            this.handleTestEvent(event);
          }
        },
        error: (error: Error) => {
          this.logService.error('Test events stream error:', error);
        },
      });
  }

  /**
   * Handle test events (completed, failed)
   */
  private async handleTestEvent(event: {
    testId: string;
    status: string;
    configId?: string;
  }): Promise<void> {
    if (event.status === 'completed' || event.status === 'failed') {
      await this.refreshTest(event.testId);
    }
  }

  /**
   * Refresh a single test with updated data and metrics
   */
  private async refreshTest(testId: string): Promise<void> {
    try {
      const updatedTest = await this.testService.getTestById(testId);

      // Fetch summary for completed tests
      if (
        updatedTest.status === 'completed' ||
        updatedTest.status === 'failed'
      ) {
        try {
          const summary = await this.testService.getTestSummary(testId);
          this.testSummaries.update((map) => {
            const newMap = new Map(map);
            newMap.set(testId, summary);
            return newMap;
          });
        } catch (summaryError) {
          this.logService.error(
            `Failed to load summary for test ${testId}:`,
            summaryError,
          );
        }
      }

      this.tests.update((tests) => {
        const index = tests.findIndex((t) => t.id === testId);
        if (index !== -1) {
          const newTests = [...tests];
          newTests[index] = updatedTest;
          return newTests;
        }
        return tests;
      });
    } catch (error) {
      this.logService.error(`Failed to refresh test ${testId}:`, error);
    }
  }

  /**
   * Update running test with real-time metrics
   */
  private updateRunningTest(metric: AggregatedMetric): void {
    this.tests.update((tests) => {
      const runningTestIndex = tests.findIndex((t) => t.status === 'running');
      if (runningTestIndex === -1) return tests;

      const updatedTest = { ...tests[runningTestIndex] };
      // Update test fields based on metric - use the metric to ensure it's referenced
      updatedTest.epochUpdatedAt = metric.epoch;

      const newTests = [...tests];
      newTests[runningTestIndex] = updatedTest;
      return newTests;
    });
  }

  /**
   * Calculate error rate for display
   */
  calculateErrorRate(test: TestDocument): string {
    if (test.status === 'running') {
      const metrics = this.latestMetrics();
      if (metrics) {
        return `${metrics.global.errorRate}%`;
      }
    }
    if (test.status === 'failed') {
      return '100%';
    }
    if (test.status === 'completed') {
      const summary = this.testSummaries().get(test.id);
      if (summary) {
        return `${summary.global.errorRate}%`;
      }
    }
    return test.error ? 'Error' : '0%';
  }

  /**
   * Get request count from real-time metrics or cached metrics
   */
  getRequestCount(test: TestDocument): string {
    if (test.status === 'running') {
      const metrics = this.latestMetrics();
      if (metrics) {
        return metrics.global.totalRequests.toLocaleString();
      }
    }
    if (test.status === 'completed') {
      const summary = this.testSummaries().get(test.id);
      if (summary) {
        return summary.global.totalRequests.toLocaleString();
      }
    }
    return '0';
  }

  /**
   * Get test to delete ID safely
   */
  getTestToDeleteId(): string {
    return this.testToDelete()?.id || '';
  }

  /**
   * Get test to delete status safely
   */
  getTestToDeleteStatus(): string {
    return this.testToDelete()?.status || 'unknown';
  }

  /**
   * Get test to delete start time safely
   */
  getTestToDeleteStartTime(): string {
    const test = this.testToDelete();
    if (!test) return '';
    return new Date(
      test.epochStartedAt || test.epochCreatedAt,
    ).toLocaleString();
  }

  /**
   * Clean up subscriptions when component is destroyed
   */
  ngOnDestroy(): void {
    this.metricsSubscription?.unsubscribe();
    this.testEventsSubscription?.unsubscribe();
  }
}
