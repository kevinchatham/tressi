import { Directive, ElementRef, effect, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatNetwork]',
})
export class FormatNetworkThroughputDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatNetwork',
  });

  constructor() {
    effect(() => {
      const bytesPerSec = this.value();
      if (bytesPerSec === undefined || bytesPerSec === null || bytesPerSec === 0) {
        this._el.nativeElement.textContent = '0 B/s';
        return;
      }

      const absValue = Math.abs(bytesPerSec);

      if (absValue < 1024) {
        this._el.nativeElement.textContent = `${Math.round(bytesPerSec)} B/s`;
      } else if (absValue < 1024 * 1024) {
        this._el.nativeElement.textContent = `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
      } else if (absValue < 1024 * 1024 * 1024) {
        this._el.nativeElement.textContent = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
      } else {
        this._el.nativeElement.textContent = `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(
          2,
        )} GB/s`;
      }
    });
  }
}
