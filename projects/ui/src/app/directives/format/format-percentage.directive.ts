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
      const absV = Math.abs(v);
      const decimals = absV < 100 ? 1 : 0;
      let formatted = v.toFixed(decimals);
      if (absV >= 10 && formatted.endsWith('.0')) {
        formatted = formatted.slice(0, -2);
      }
      this._el.nativeElement.textContent = formatted + '%';
    });
  }
}
