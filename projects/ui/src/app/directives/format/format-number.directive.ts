import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { formatCompactNumber } from '@tressi/shared/common';

@Directive({
  selector: '[appFormatNumber]',
})
export class FormatNumberDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatNumber',
  });

  constructor() {
    effect(() => {
      const value = this.value();
      if (value === undefined || value === null) {
        this._el.nativeElement.textContent = '0';
        return;
      }
      const numValue = Number(value);
      if (numValue === 0) {
        this._el.nativeElement.textContent = '0';
        return;
      }
      const absValue = Math.abs(numValue);
      this._el.nativeElement.textContent = formatCompactNumber(absValue);
    });
  }
}
