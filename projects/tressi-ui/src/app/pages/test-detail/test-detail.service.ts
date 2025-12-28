import { inject, Injectable } from '@angular/core';
import { signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { EventService, TestEventData } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import { TestDocument, TestMetrics } from '../../services/rpc.service';
import { TestService } from '../../services/test.service';
import {
  EndpointMetric,
  EndpointMetricsWithSummary,
  GlobalMetric,
} from './test-detail.types';

/**
 * Real-time metrics data structure from the event stream
 */
interface RealTimeMetricsData {
  testId: string;
  globalMetrics: Array<GlobalMetric>;
  endpointMetrics: Array<EndpointMetric>;
}

@Injectable({ providedIn: 'root' })
export class TestDetailService {
  private readonly testService = inject(TestService);
  private readonly eventService = inject(EventService);
  private readonly loadingService = inject(LoadingService);
  private readonly logService = inject(LogService);

  // Public signals
  readonly test = signal<TestDocument | null>(null);
  readonly metrics = signal<TestMetrics | null>(null);

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

  groupEndpointMetrics(
    metrics: TestMetrics | null,
  ): EndpointMetricsWithSummary[] {
    if (!metrics) return [];

    const endpointMap = new Map<string, EndpointMetricsWithSummary>();

    for (const endpointMetric of metrics.endpoints || []) {
      const url = endpointMetric.url;
      if (!endpointMap.has(url)) {
        endpointMap.set(url, {
          url,
          metrics: [],
          summary: {
            avgThroughput: 0,
            avgLatency: 0,
            avgErrorRate: 0,
          },
        });
      }
      endpointMap.get(url)!.metrics.push(endpointMetric);
    }

    // Calculate summaries
    for (const endpoint of endpointMap.values()) {
      const values = endpoint.metrics.map((m) => m.metric);
      const avgThroughput =
        values.reduce((sum, m) => sum + m.requestsPerSecond, 0) /
          values.length || 0;
      const avgLatency =
        values.reduce((sum, m) => sum + m.averageLatency, 0) / values.length ||
        0;
      const avgErrorRate =
        values.reduce((sum, m) => sum + m.errorRate, 0) / values.length || 0;

      endpoint.summary = {
        avgThroughput,
        avgLatency,
        avgErrorRate,
      };
    }

    return Array.from(endpointMap.values()).sort((a, b) =>
      a.url.localeCompare(b.url),
    );
  }

  startRealTimeUpdates(testId: string | null): void {
    if (!testId) return;

    // Clean up existing subscriptions
    this.cleanupSubscriptions();

    // Subscribe to metrics stream for real-time updates
    this.metricsStreamSubscription = this.eventService
      .getMetricsStream()
      .subscribe({
        next: (testSummary) => {
          const typedSummary = testSummary as unknown as RealTimeMetricsData;
          if (typedSummary.testId === testId) {
            this.mergeRealTimeMetrics(typedSummary);
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

  private mergeRealTimeMetrics(testSummary: RealTimeMetricsData): void {
    const currentMetrics = this.metrics();
    if (!currentMetrics) return;

    // Merge new metrics with existing ones
    const updatedMetrics: TestMetrics = {
      ...currentMetrics,
      global: [...(currentMetrics.global || []), ...testSummary.globalMetrics],
      endpoints: [
        ...(currentMetrics.endpoints || []),
        ...testSummary.endpointMetrics,
      ],
    };

    // Keep only last 1000 data points to prevent memory issues
    if (updatedMetrics.global.length > 1000) {
      updatedMetrics.global = updatedMetrics.global.slice(-1000);
    }
    if (updatedMetrics.endpoints.length > 1000) {
      updatedMetrics.endpoints = updatedMetrics.endpoints.slice(-1000);
    }

    this.metrics.set(updatedMetrics);
  }

  private handleTestEvent(event: TestEventData): void {
    const currentTest = this.test();
    if (!currentTest || currentTest.id !== event.testId) return;

    // Update test status
    this.test.set({
      ...currentTest,
      status: event.status,
      epochEndedAt: event.status === 'completed' ? Date.now() : null,
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
