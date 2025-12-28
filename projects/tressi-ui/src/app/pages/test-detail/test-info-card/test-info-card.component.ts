import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { IconComponent } from '../../../components/icon/icon.component';
import { TestDocument } from '../../../services/rpc.service';

@Component({
  selector: 'app-test-info-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './test-info-card.component.html',
})
export class TestInfoCardComponent {
  readonly test = input.required<TestDocument>();
  readonly configName = input.required<string>();
  readonly isRealTime = input.required<boolean>();
  readonly collapsed = input.required<boolean>();

  readonly collapsedChange = output<boolean>();

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed());
  }

  getStatusBadgeClass(): string {
    const status = this.test().status;
    switch (status) {
      case 'running':
        return 'badge-info';
      case 'completed':
        return 'badge-success';
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-neutral';
    }
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
}
