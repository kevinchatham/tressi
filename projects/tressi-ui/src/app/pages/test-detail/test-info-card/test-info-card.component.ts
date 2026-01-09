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

  formatDate(epoch: number | null | undefined): string {
    if (!epoch) return 'N/A';
    return new Date(epoch).toLocaleString();
  }

  formatDuration(): string {
    const test = this.test();
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

  roundNumber(num: number): number {
    return Math.round(num);
  }
}
