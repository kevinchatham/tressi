import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

import type { TestStatus } from '../../services/rpc.service';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-status-badge',
  imports: [CommonModule, IconComponent],
  templateUrl: './status-badge.component.html',
})
export class StatusBadgeComponent {
  status = input.required<TestStatus>();
  showIcon = input<boolean>(true);
  showPulse = input<boolean>(false);

  getStatusColor(): string {
    switch (this.status()) {
      case 'running':
        return 'text-info bg-info/20';
      case 'completed':
        return 'text-success bg-success/20';
      case 'failed':
        return 'text-error bg-error/20';
      default:
        return 'text-neutral bg-neutral/20';
    }
  }

  getStatusIcon(): IconName {
    switch (this.status()) {
      case 'running':
        return 'dynamic_form';
      case 'completed':
        return 'check';
      case 'failed':
        return 'warning';
      default:
        return 'info';
    }
  }

  getDisplayText(): string {
    return (
      (this.status() || 'unknown').charAt(0).toUpperCase() +
      (this.status() || 'unknown').slice(1)
    );
  }
}
