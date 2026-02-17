import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatBytes]',
})
export class FormatBytesDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatBytes',
  });

  constructor() {
    effect(() => {
      const bytes = this.value();
      if (bytes === undefined || bytes === null || bytes === 0) {
        this._el.nativeElement.textContent = '0 B';
        return;
      }

      const absValue = Math.abs(bytes);

      if (absValue < 1024) {
        this._el.nativeElement.textContent = `${Math.round(bytes)} B`;
      } else if (absValue < 1024 * 1024) {
        this._el.nativeElement.textContent = `${(bytes / 1024).toFixed(1)} KB`;
      } else if (absValue < 1024 * 1024 * 1024) {
        this._el.nativeElement.textContent = `${(bytes / (1024 * 1024)).toFixed(
          1,
        )} MB`;
      } else {
        this._el.nativeElement.textContent = `${(
          bytes /
          (1024 * 1024 * 1024)
        ).toFixed(2)} GB`;
      }
    });
  }
}
