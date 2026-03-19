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
      this._el.nativeElement.textContent = `${Math.trunc(value).toLocaleString()}/s`;
    });
  }
}
