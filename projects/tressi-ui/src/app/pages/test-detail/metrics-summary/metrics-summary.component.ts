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
}
