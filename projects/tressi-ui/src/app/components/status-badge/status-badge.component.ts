import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

import type { TestStatus } from '../../services/rpc.service';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-status-badge',
  standalone: true,
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
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  getStatusIcon(): IconName {
    switch (this.status()) {
      case 'running':
        return 'rocket';
      case 'completed':
        return 'select';
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
