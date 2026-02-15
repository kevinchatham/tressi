import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatCpu]',
})
export class FormatCpuUsageDirective {
  private readonly el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatCpu',
  });

  constructor() {
    effect(() => {
      const percent = this.value();
      if (percent === undefined || percent === null) {
        this.el.nativeElement.textContent = '0.0%';
        return;
      }
      this.el.nativeElement.textContent = `${percent.toFixed(1)}%`;
    });
  }
}
