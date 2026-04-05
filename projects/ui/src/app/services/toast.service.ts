import { Injectable, signal } from '@angular/core';

type ToastType = 'info' | 'success' | 'warning' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _message = signal<string>('');
  private readonly _type = signal<ToastType>('info');
  private readonly _isVisible = signal<boolean>(false);
  private readonly _duration = signal<number>(5000);
  private _timeoutId: NodeJS.Timeout | number | null = null;

  readonly toastMessage = this._message.asReadonly();
  readonly toastType = this._type.asReadonly();
  readonly showToast = this._isVisible.asReadonly();

  show(message: string, type: ToastType = 'info'): void {
    // Clear any existing timeout
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
    }

    // Set new toast state
    this._message.set(message);
    this._type.set(type);
    this._isVisible.set(true);

    // Auto-dismiss after duration
    this._timeoutId = globalThis.setTimeout(() => {
      this.dismiss();
    }, this._duration());
  }

  dismiss(): void {
    this._isVisible.set(false);
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    // Clear message and type after fade out
    setTimeout(() => {
      this._message.set('');
      this._type.set('info');
    }, 300);
  }
}
