import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { CollapsibleCardComponent } from '../../../components/collapsible-card/collapsible-card.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import {
  EndpointSummary,
  LatencyHistogram,
  TestDocument,
} from '../../../services/rpc.service';
import { LatencyHistogramComponent } from '../latency-histogram/latency-histogram.component';
import { ResponseSamplesComponent } from '../response-samples/response-samples.component';
import { isEndpointSummary } from '../test-detail-shared.types';

/**
 * Component for displaying test information and analysis
 * Extracted from test-detail.component.html lines 107-269
 */
@Component({
  selector: 'app-test-summary',
  imports: [
    CommonModule,
    CollapsibleCardComponent,
    IconComponent,
    StatusBadgeComponent,
    LatencyHistogramComponent,
    ResponseSamplesComponent,
  ],
  templateUrl: './test-summary.component.html',
})
export class TestSummaryComponent {
  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

  /** Selected summary (global or endpoint) */
  readonly selectedSummary = input<unknown>(null);

  /** Endpoint summary with distribution data */
  readonly endpointSummary = input<EndpointSummary | null>(null);

  /** Whether the test is running in real-time */
  readonly isRealTime = input<boolean>(false);

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(false);

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

  /**
   * Handle collapsed state change from collapsible card
   */
  onCollapsedChange(collapsed: boolean): void {
    this.collapsedChange.emit(collapsed);
  }

  /**
   * Format epoch timestamp to locale string
   */
  formatDate(epoch: number | null | undefined): string {
    if (!epoch) return 'N/A';
    return new Date(epoch).toLocaleString();
  }

  /**
   * Format test duration
   */
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

  /**
   * Check if analysis data exists for display
   */
  hasAnalysisData(): boolean {
    const summary = this.selectedSummary();
    if (!summary) return false;

    // Check for histogram (exists on both GlobalSummary and EndpointSummary)
    const hasHistogram =
      typeof summary === 'object' &&
      summary !== null &&
      'histogram' in summary &&
      summary.histogram;

    if (hasHistogram) return true;

    // statusCodeDistribution and responseSamples only exist on EndpointSummary
    if (isEndpointSummary(summary)) {
      return !!(summary.statusCodeDistribution || summary.responseSamples);
    }

    return false;
  }

  /**
   * Get histogram data from selected summary
   */
  getHistogram(): LatencyHistogram | undefined {
    const summary = this.selectedSummary();
    if (summary && typeof summary === 'object' && 'histogram' in summary) {
      return summary.histogram as LatencyHistogram;
    }
    return undefined;
  }
}
