import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { IconComponent } from '../../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { TestDocument, TestMetrics } from '../../../services/rpc.service';

@Component({
  selector: 'app-test-info-card',
  standalone: true,
  imports: [CommonModule, IconComponent, StatusBadgeComponent],
  templateUrl: './test-info-card.component.html',
})
export class TestInfoCardComponent {
  readonly test = input.required<TestDocument>();
  readonly configName = input.required<string>();
  readonly isRealTime = input.required<boolean>();
  readonly collapsed = input.required<boolean>();
  readonly metrics = input<TestMetrics | null>(null);
  readonly summary = input<TestDocument['summary'] | null>(null);

  readonly collapsedChange = output<boolean>();

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed());
  }

  formatDate(epoch: number | null): string {
    if (!epoch) return 'N/A';
    return new Date(epoch).toLocaleString();
  }

  formatDuration(): string {
    const test = this.test();
    if (test.status === 'running') {
      return 'Running...';
    }
    if (test.epochEndedAt && test.epochStartedAt) {
      const duration = test.epochEndedAt - test.epochStartedAt;
      return `${Math.round(duration / 1000)}s`;
    }
    return test.summary?.global?.duration
      ? `${test.summary.global.duration}s`
      : 'N/A';
  }

  // Methods from metrics-summary-card
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
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length || 0;
    return Math.round(avg);
  }

  getGlobalAvgLatency(): number {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return 0;

    const values = metrics.global.map((m) => m.metric?.averageLatency || 0);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length || 0;
    return Math.round(avg);
  }

  getGlobalAvgErrorRate(): number {
    const metrics = this.metrics();
    if (!metrics?.global?.length) return 0;

    const values = metrics.global.map((m) => m.metric?.errorPercentage || 0);
    return values.reduce((sum, val) => sum + val, 0) / values.length || 0;
  }

  roundNumber(num: number): number {
    return Math.round(num);
  }
}
