import { Component, computed, inject, output } from '@angular/core';
import type { IconName } from '@tressi/shared/ui';

import { ToastService } from '../../services/toast.service';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  imports: [IconComponent, ButtonComponent],
  selector: 'app-toast',
  styleUrls: ['./toast.component.css'],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
  dismissed = output<void>();

  readonly iconName = computed<IconName>(() => {
    switch (this.toastService.toastType()) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'check';
      default:
        return 'info';
    }
  });

  readonly alertClass = computed<string>(() => {
    switch (this.toastService.toastType()) {
      case 'error':
        return 'alert alert-error';
      case 'warning':
        return 'alert alert-warning';
      case 'success':
        return 'alert alert-success';
      default:
        return 'alert alert-info';
    }
  });

  onDismiss(): void {
    this.toastService.dismiss();
    this.dismissed.emit();
  }
}
