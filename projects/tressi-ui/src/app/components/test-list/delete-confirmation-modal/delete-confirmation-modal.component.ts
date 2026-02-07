import { Component, input, output } from '@angular/core';

import type { TestDocument } from '../../../services/rpc.service';
import { ButtonComponent } from '../../button/button.component';

@Component({
  selector: 'app-delete-confirmation-modal',
  imports: [ButtonComponent],
  templateUrl: './delete-confirmation-modal.component.html',
})
export class DeleteConfirmationModalComponent {
  showDeleteModal = input.required<boolean>();
  isBulkDelete = input.required<boolean>();
  testToDelete = input<TestDocument | null>(null);
  selectedTestsCount = input.required<number>();

  confirmDelete = output<void>();
  cancelDelete = output<void>();

  onConfirmDelete(): void {
    this.confirmDelete.emit();
  }

  onCancelDelete(): void {
    this.cancelDelete.emit();
  }

  getTestToDeleteId(): string {
    if (this.isBulkDelete()) {
      const count = this.selectedTestsCount();
      return count > 0 ? `${count} test(s)` : '';
    }
    return this.testToDelete()?.id || '';
  }

  getTestToDeleteStatus(): string {
    if (this.isBulkDelete()) {
      return `${this.selectedTestsCount()} tests selected`;
    }
    return this.testToDelete()?.status || 'unknown';
  }

  getTestToDeleteStartTime(): string {
    if (this.isBulkDelete()) {
      return 'Multiple tests';
    }
    const test = this.testToDelete();
    if (!test) return '';
    return new Date(
      test.summary?.global.epochStartedAt || test.epochCreatedAt,
    ).toLocaleString();
  }
}
