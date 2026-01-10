import { computed, inject, Injectable } from '@angular/core';
import { signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { EventService, TestEventData } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import {
  TestDocument,
  TestMetrics,
  TestSummary,
} from '../../services/rpc.service';
import { TestService } from '../../services/test.service';
import { SummaryStats } from './metrics-summary/metrics-summary.component';

@Injectable({ providedIn: 'root' })
export class TestDetailService {
  private readonly testService = inject(TestService);
  private readonly eventService = inject(EventService);
  private readonly loadingService = inject(LoadingService);
  private readonly logService = inject(LogService);

  // Public signals
  readonly test = signal<TestDocument | null>(null);
  readonly metrics = signal<TestMetrics | null>(null);
  readonly selectedEndpoint = signal<string>('global');

  // Computed signals for enhanced metrics
  readonly summaryStats = computed<SummaryStats | null>(() => {
    const test = this.test();
    if (!test?.summary) return null;

    const isGlobal = this.selectedEndpoint() === 'global';

    if (isGlobal) {
      const global = test.summary.global;
      const durationSec = global.finalDurationSec || 1;
      const requestsPerSecond = Math.round(global.totalRequests / durationSec);

      return {
        totalRequests: global.totalRequests,
        requestsPerSecond,
        minLatencyMs: global.minLatencyMs,
        maxLatencyMs: global.maxLatencyMs,
        p50LatencyMs: global.p50LatencyMs,
        p95LatencyMs: global.p95LatencyMs,
        p99LatencyMs: global.p99LatencyMs,
        errorRate: this.calculateErrorRate(
          global.totalRequests,
          global.failedRequests,
        ),
        successfulRequests: global.successfulRequests,
        failedRequests: global.failedRequests,
      };
    } else {
      const endpointUrl = this.selectedEndpoint();
      const endpoint = test.summary.endpoints?.find(
        (e) => e.url === endpointUrl,
      );

      if (!endpoint) return null;

      return {
        totalRequests: endpoint.totalRequests,
        requestsPerSecond: endpoint.requestsPerSecond,
        minLatencyMs: endpoint.minLatencyMs,
        maxLatencyMs: endpoint.maxLatencyMs,
        p50LatencyMs: endpoint.p50LatencyMs,
        p95LatencyMs: endpoint.p95LatencyMs,
        p99LatencyMs: endpoint.p99LatencyMs,
        errorRate: this.calculateErrorRate(
          endpoint.totalRequests,
          endpoint.failedRequests,
        ),
        successfulRequests: endpoint.successfulRequests,
        failedRequests: endpoint.failedRequests,
      };
    }
  });

  private calculateErrorRate(
    totalRequests: number,
    failedRequests: number,
  ): number {
    return totalRequests > 0
      ? Math.round((failedRequests / totalRequests) * 100)
      : 0;
  }

  // Private state
  private metricsStreamSubscription: Subscription | null = null;
  private testEventsSubscription: Subscription | null = null;

  async loadTestDetails(
    testId: string,
  ): Promise<{ test: TestDocument; metrics: TestMetrics }> {
    this.loadingService.setPageLoading('test-detail', true);

    try {
      const [testResult, metricsResult] = await Promise.all([
        this.testService.getTestById(testId),
        this.testService.getTestMetrics(testId),
      ]);

      this.test.set(testResult);
      this.metrics.set(metricsResult);

      return { test: testResult, metrics: metricsResult };
    } catch (error) {
      this.logService.error('Failed to load test details', error);
      throw error;
    } finally {
      this.loadingService.setPageLoading('test-detail', false);
    }
  }

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private mergeRealTimeMetrics(_testSummary: TestSummary): void {
    const currentMetrics = this.metrics();
    if (!currentMetrics) return;

    // The event stream sends TestSummary (aggregated statistics), not raw documents
    // We need to convert TestSummary to TestMetrics format for merging
    // This is a simplified conversion - in a real app you might want more sophisticated handling

    // For now, we'll just update the signals with the summary data
    // The actual merging of raw documents happens differently
  }

  private handleTestEvent(event: TestEventData): void {
    const currentTest = this.test();
    if (!currentTest || currentTest.id !== event.testId) return;

    // Update test status - note: we don't set epochEndedAt here anymore
    // as it should be set by the backend when the test completes
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
}
