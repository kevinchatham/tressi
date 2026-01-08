import { Injectable, signal } from '@angular/core';

type ToastType = 'info' | 'success' | 'warning' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly message = signal<string>('');
  private readonly type = signal<ToastType>('info');
  private readonly isVisible = signal<boolean>(false);
  private readonly duration = signal<number>(5000);
  private timeoutId: number | null = null;

  readonly toastMessage = this.message.asReadonly();
  readonly toastType = this.type.asReadonly();
  readonly showToast = this.isVisible.asReadonly();

  show(message: string, type: ToastType = 'info'): void {
    // Clear any existing timeout
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    // Set new toast state
    this.message.set(message);
    this.type.set(type);
    this.isVisible.set(true);

    // Auto-dismiss after duration
    this.timeoutId = window.setTimeout(() => {
      this.dismiss();
    }, this.duration());
  }

  dismiss(): void {
    this.isVisible.set(false);
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Clear message and type after fade out
    setTimeout(() => {
      this.message.set('');
      this.type.set('info');
    }, 300);
  }
}
