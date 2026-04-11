import { Directive, ElementRef, effect, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatRps]',
})
export class FormatRpsDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatRps',
  });

  constructor() {
    effect(() => {
      const value = this.value();
      if (!value) {
        this._el.nativeElement.textContent = '0/s';
        return;
      }
      const displayValue =
        value < 1 && value > 0 ? Math.floor(value * 10) / 10 : Math.trunc(value).toLocaleString();
      this._el.nativeElement.textContent = `${displayValue}/s`;
    });
  }
}
