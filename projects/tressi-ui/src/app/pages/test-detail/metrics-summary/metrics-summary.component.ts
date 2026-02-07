import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { IconComponent } from '../../../components/icon/icon.component';

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
  imports: [CommonModule, IconComponent],
  templateUrl: './metrics-summary.component.html',
})
export class MetricsSummaryComponent {
  @Input() summary: any = null;
  @Input() endpointType: 'global' | 'endpoint' = 'global';

  /** Tooltip content mapping */
  tooltips = METRIC_TOOLTIPS;

  isGlobalSummary(summary: any): summary is any {
    return this.endpointType === 'global' && summary !== null;
  }

  isEndpointSummary(summary: any): summary is any {
    return this.endpointType === 'endpoint' && summary !== null;
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  formatPercentage(value: number | undefined): string {
    if (value === undefined || value === null) return '0.0%';
    return `${value.toFixed(1)}%`;
  }

  formatRps(value: number | undefined): string {
    if (!value) return '0/s';
    return `${Math.round(value)}/s`;
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  }

  /**
   * Formats network throughput with appropriate units (B/s, KB/s, MB/s, GB/s)
   */
  formatNetworkThroughput(bytesPerSec: number | undefined): string {
    if (
      bytesPerSec === undefined ||
      bytesPerSec === null ||
      bytesPerSec === 0
    ) {
      return '0 B/s';
    }

    const absValue = Math.abs(bytesPerSec);

    if (absValue < 1024) {
      return `${Math.round(bytesPerSec)} B/s`;
    } else if (absValue < 1024 * 1024) {
      return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    } else if (absValue < 1024 * 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    } else {
      return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
    }
  }

  /**
   * Formats bytes to human-readable format (B, KB, MB, GB)
   */
  formatBytes(bytes: number | undefined): string {
    if (bytes === undefined || bytes === null || bytes === 0) {
      return '0 B';
    }

    const absValue = Math.abs(bytes);

    if (absValue < 1024) {
      return `${Math.round(bytes)} B`;
    } else if (absValue < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (absValue < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }

  /**
   * Formats CPU usage percentage
   */
  formatCpuUsage(percent: number | undefined): string {
    if (percent === undefined || percent === null) return '0.0%';
    return `${percent.toFixed(1)}%`;
  }

  /**
   * Formats memory usage with MB or GB units
   */
  formatMemoryMB(mb: number | undefined): string {
    if (mb === undefined || mb === null) return '0 MB';

    if (mb < 1024) {
      return `${Math.round(mb)} MB`;
    } else {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
  }

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
