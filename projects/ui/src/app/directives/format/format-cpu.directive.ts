import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatCpu]',
})
export class FormatCpuUsageDirective {
  private readonly _el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatCpu',
  });

  constructor() {
    effect(() => {
      const percent = this.value();
      if (percent === undefined || percent === null) {
        this._el.nativeElement.textContent = '0.0%';
        return;
      }
      this._el.nativeElement.textContent = `${percent.toFixed(1)}%`;
    });
  }
}
