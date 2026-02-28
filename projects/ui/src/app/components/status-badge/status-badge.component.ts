import { NgClass } from '@angular/common';
import { Component, input } from '@angular/core';
import { TestStatus } from '@tressi/shared/common';
import { IconName } from '@tressi/shared/ui';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-status-badge',
  imports: [IconComponent, NgClass],
  templateUrl: './status-badge.component.html',
})
export class StatusBadgeComponent {
  status = input.required<TestStatus>();
  showIcon = input<boolean>(true);
  showPulse = input<boolean>(false);

  getStatusColor(): string {
    const runningColor = 'text-info bg-info/25';
    const completedColor = 'text-success bg-success/25';
    const failedColor = 'text-error bg-error/25';
    const cancelledColor = 'text-neutral-content bg-neutral/25';

    switch (this.status()) {
      case 'running':
        return runningColor;
      case 'completed':
        return completedColor;
      case 'failed':
        return failedColor;
      case 'cancelled':
        return cancelledColor;
      default:
        return cancelledColor;
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
      case 'cancelled':
        return 'close';
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
