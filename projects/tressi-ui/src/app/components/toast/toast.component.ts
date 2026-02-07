import { Component, computed, inject, output } from '@angular/core';

import { ToastService } from '../../services/toast.service';
import { ButtonComponent } from '../button/button.component';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  imports: [IconComponent, ButtonComponent],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
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
      case 'info':
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
      case 'info':
      default:
        return 'alert alert-info';
    }
  });

  onDismiss(): void {
    this.toastService.dismiss();
    this.dismissed.emit();
  }
}
