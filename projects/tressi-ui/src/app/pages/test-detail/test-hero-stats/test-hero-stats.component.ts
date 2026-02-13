import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';

import {
  EndpointSummary,
  GlobalSummary,
  TestDocument,
} from '../../../services/rpc.service';
import { TestService } from '../../../services/test.service';

@Component({
  selector: 'app-test-hero-stats',
  imports: [CommonModule],
  templateUrl: './test-hero-stats.component.html',
})
export class TestHeroStatsComponent {
  private readonly testService = inject(TestService);

  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

  /** Selected summary (global or endpoint) */
  readonly selectedSummary = input<GlobalSummary | EndpointSummary | null>(
    null,
  );

  /** Whether the test is running in real-time */
  readonly isRealTime = input<boolean>(false);

  /** Selected endpoint URL or 'global' */
  readonly selectedEndpoint = input<string>('global');

  /**
   * Computed success rate percentage
   */
  readonly successRate = computed(() => {
    const summary = this.selectedSummary();
    if (!summary) return 0;
    return 100 - (summary.errorRate || 0) * 100;
  });

  /**
   * Format RPS value
   */
  formatRps(value: number | undefined): string {
    if (!value) return '0';
    return Math.round(value).toLocaleString();
  }

  /**
   * Format latency value
   */
  formatLatency(value: number | undefined): string {
    if (!value) return '0';
    return Math.round(value).toLocaleString();
  }

  /**
   * Format percentage value
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Format test duration
   */
  formatDuration(): string {
    const test = this.testData();
    if (!test) return 'N/A';

    const durationMs = this.testService.getTestDuration(test);
    return this.testService.formatDuration(durationMs);
  }
}
