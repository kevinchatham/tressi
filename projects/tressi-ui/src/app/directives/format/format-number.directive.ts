import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import humanNumber from 'human-number';

@Directive({
  selector: '[appFormatNumber]',
})
export class FormatNumberDirective {
  private readonly el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatNumber',
  });

  constructor() {
    effect(() => {
      const value = this.value();
      if (value === undefined || value === null) {
        this.el.nativeElement.textContent = '0';
        return;
      }
      this.el.nativeElement.textContent = humanNumber(value, (n) =>
        n.toFixed(0),
      );
    });
  }
}
