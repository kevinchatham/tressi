import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { IconComponent } from '../../../components/icon/icon.component';
import { TestDocument, TestMetrics } from '../../../services/rpc.service';

@Component({
  selector: 'app-metrics-summary-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './metrics-summary-card.component.html',
})
export class MetricsSummaryCardComponent {
  readonly metrics = input<TestMetrics | null>(null);
  readonly type = input.required<'global' | 'endpoint'>();
  readonly summary = input<TestDocument['summary'] | null>(null);
  readonly collapsed = input.required<boolean>();

  readonly collapsedChange = output<boolean>();

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed());
  }

  getTotalRequests(): number {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return 0;

    return metrics.global.reduce(
      (sum, m) => sum + (m.metric?.totalRequests || 0),
      0,
    );
  }

  getGlobalAvgThroughput(): number {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return 0;

    const values = metrics.global.map((m) => m.metric?.requestsPerSecond || 0);
    return values.reduce((sum, val) => sum + val, 0) / values.length || 0;
  }

  getGlobalAvgLatency(): number {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return 0;

    const values = metrics.global.map((m) => m.metric?.averageLatency || 0);
    return values.reduce((sum, val) => sum + val, 0) / values.length || 0;
  }

  getGlobalAvgErrorRate(): number {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return 0;

    const values = metrics.global.map((m) => m.metric?.errorRate || 0);
    return values.reduce((sum, val) => sum + val, 0) / values.length || 0;
  }
}
