import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface SummaryStats {
  totalRequests: number;
  requestsPerSecond: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  successfulRequests: number;
  failedRequests: number;
  // View-specific optional fields
  finalDurationSec?: number;
  totalEndpoints?: number;
  targetAchieved?: number;
  theoreticalMaxRps?: number;
}

@Component({
  selector: 'app-metrics-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics-summary.component.html',
})
export class MetricsSummaryComponent {
  @Input() stats!: SummaryStats | null;
  @Input() endpointType: 'global' | 'endpoint' = 'global';

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
}
