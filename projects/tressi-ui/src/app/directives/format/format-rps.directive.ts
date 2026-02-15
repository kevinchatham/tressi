import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatRps]',
})
export class FormatRpsDirective {
  private readonly el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatRps',
  });

  constructor() {
    effect(() => {
      const value = this.value();
      if (!value) {
        this.el.nativeElement.textContent = '0/s';
        return;
      }
      this.el.nativeElement.textContent = `${Math.trunc(value).toLocaleString()}/s`;
    });
  }
}
