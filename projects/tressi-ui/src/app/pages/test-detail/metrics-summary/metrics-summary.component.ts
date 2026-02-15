import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { IconComponent } from '../../../components/icon/icon.component';
import { FormatBytesDirective } from '../../../directives/format/format-bytes.directive';
import { FormatCpuUsageDirective } from '../../../directives/format/format-cpu.directive';
import { FormatDurationDirective } from '../../../directives/format/format-duration.directive';
import { FormatLatencyDirective } from '../../../directives/format/format-latency.directive';
import { FormatMemoryDirective } from '../../../directives/format/format-memory.directive';
import { FormatNetworkThroughputDirective } from '../../../directives/format/format-network.directive';
import { FormatNumberDirective } from '../../../directives/format/format-number.directive';
import { FormatPercentageDirective } from '../../../directives/format/format-percentage.directive';
import { FormatRpsDirective } from '../../../directives/format/format-rps.directive';
import { EndpointSummary, GlobalSummary } from '../../../services/rpc.service';

/**
 * Color state for performance metrics
 */
export type MetricState = 'good' | 'warning' | 'error';

/**
 * Tooltip content for metric labels
 */
export const METRIC_TOOLTIPS: Record<string, string> = {
  minLatency: 'Minimum response time observed during the test',
  p50Latency: 'Median response time - 50% of requests were faster than this',
  p95Latency: '95th percentile - 95% of requests were faster than this (slow)',
  p99Latency:
    '99th percentile - 99% of requests were faster than this (slower)',
  maxLatency: 'Maximum response time observed during the test (slowest)',
  duration: 'Total duration of the test from start to completion',
  endpoints: 'Number of unique endpoints tested',
  targetAchieved: 'Percentage of target RPS that was actually achieved',
  maxThroughput: 'Theoretical maximum RPS based on average latency',
  avgRps: 'Average requests per second throughout the test',
  peakRps: 'Highest requests per second achieved in any 1-second window',
  totalRequests: 'Total number of requests made during the test',
  errorRate: 'Percentage of requests that failed (non-2xx or network errors)',
  networkThroughput: 'Average data transfer rate during the test',
  networkSent: 'Total bytes sent in request bodies across all requests',
  networkReceived:
    'Total bytes received in response bodies across all requests',
  cpuUsage:
    'Average system CPU utilization during the test (Warning: >70%, Critical: >85%)',
  memoryUsage:
    'Average process memory consumption during the test (Warning: >500MB, Critical: >1GB)',
};

@Component({
  selector: 'app-metrics-summary',
  imports: [
    CommonModule,
    IconComponent,
    FormatDurationDirective,
    FormatPercentageDirective,
    FormatRpsDirective,
    FormatNumberDirective,
    FormatBytesDirective,
    FormatNetworkThroughputDirective,
    FormatCpuUsageDirective,
    FormatMemoryDirective,
    FormatLatencyDirective,
  ],
  templateUrl: './metrics-summary.component.html',
})
export class MetricsSummaryComponent {
  summary = input<GlobalSummary | EndpointSummary | null>();

  /** Tooltip content mapping */
  tooltips = METRIC_TOOLTIPS;

  endpointSummary = computed<EndpointSummary | null>(() => {
    const s = this.summary();
    if (s && 'statusCodeDistribution' in s)
      return s as unknown as EndpointSummary;
    else return null;
  });

  globalSummary = computed<GlobalSummary | null>(() => {
    const s = this.summary();
    if (s && !('statusCodeDistribution' in s))
      return s as unknown as GlobalSummary;
    else return null;
  });

  /**
   * Determines CPU usage state based on percentage thresholds
   * - Good: < 70%
   * - Warning: 70-85%
   * - Error: > 85%
   */
  getCpuState(percent: number | undefined): MetricState {
    if (percent === undefined || percent === null) return 'good';

    if (percent > 85) return 'error';
    if (percent > 70) return 'warning';
    return 'good';
  }

  /**
   * Determines memory usage state based on MB thresholds
   * - Good: < 500MB
   * - Warning: 500-1000MB
   * - Error: > 1000MB
   */
  getMemoryState(mb: number | undefined): MetricState {
    if (mb === undefined || mb === null) return 'good';

    if (mb > 1000) return 'error';
    if (mb > 500) return 'warning';
    return 'good';
  }

  /**
   * Gets DaisyUI color classes for a metric state
   */
  getStateClasses(state: MetricState): { bg: string; text: string } {
    switch (state) {
      case 'error':
        return { bg: 'bg-error/20', text: 'text-error' };
      case 'warning':
        return { bg: 'bg-warning/20', text: 'text-warning' };
      case 'good':
      default:
        return { bg: 'bg-success/20', text: 'text-success' };
    }
  }
}
