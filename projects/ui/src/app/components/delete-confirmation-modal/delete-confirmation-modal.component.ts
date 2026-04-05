import { LowerCasePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  imports: [IconComponent, ButtonComponent, LowerCasePipe],
  selector: 'app-delete-confirmation-modal',
  templateUrl: './delete-confirmation-modal.component.html',
})
export class DeleteConfirmationModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly id = input.required<string>();
  readonly bulkCount = input<number | null>(null);
  readonly itemLabel = input.required<string>();

  readonly confirmed = output<void>();
  readonly closed = output<void>();

  readonly isBulkDelete = computed(() => (this.bulkCount() ?? 0) > 0);

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.closed.emit();
  }

  handleBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
