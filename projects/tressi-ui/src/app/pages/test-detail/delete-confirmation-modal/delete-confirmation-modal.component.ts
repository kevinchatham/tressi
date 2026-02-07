import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { IconComponent } from '../../../components/icon/icon.component';
import { TestDocument } from '../../../services/rpc.service';

@Component({
  selector: 'app-delete-confirmation-modal',
  imports: [CommonModule, IconComponent, ButtonComponent],
  templateUrl: './delete-confirmation-modal.component.html',
})
export class DeleteConfirmationModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly test = input<TestDocument | null>(null);

  readonly confirmed = output<void>();
  readonly closed = output<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.closed.emit();
  }

  handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  getStatusBadgeClass(): string {
    const status = this.test()?.status;
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

  formatDate(epoch?: number | null): string {
    if (!epoch) return '';
    return new Date(epoch).toLocaleString();
  }
}
