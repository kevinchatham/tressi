import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatPercentage]',
})
export class FormatPercentageDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatPercentage',
  });

  constructor() {
    effect(() => {
      const value = this.value();
      if (value === undefined || value === null || value === 0) {
        this._el.nativeElement.textContent = '0%';
        return;
      }
      const v = value * 100;
      if (v < 1) {
        this._el.nativeElement.textContent = `${value.toFixed(1)}%`;
      } else {
        this._el.nativeElement.textContent = `${v.toFixed(0)}%`;
      }
    });
  }
}
