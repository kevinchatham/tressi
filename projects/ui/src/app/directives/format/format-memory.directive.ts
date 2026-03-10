import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatMemory]',
})
export class FormatMemoryDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatMemory',
  });

  constructor() {
    effect(() => {
      const mb = this.value();
      if (mb === undefined || mb === null) {
        this._el.nativeElement.textContent = '0 MB';
        return;
      }

      const absMb = Math.abs(mb);
      if (absMb < 1024) {
        this._el.nativeElement.textContent = `${Math.round(mb)} MB`;
      } else {
        this._el.nativeElement.textContent = `${(mb / 1024).toFixed(2)} GB`;
      }
    });
  }
}
