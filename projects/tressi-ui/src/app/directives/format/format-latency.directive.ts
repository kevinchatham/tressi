import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatLatency]',
})
export class FormatLatencyDirective {
  private readonly el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatLatency',
  });

  constructor() {
    effect(() => {
      const ms = this.value();
      if (ms === undefined || ms === null) {
        this.el.nativeElement.textContent = '—';
        return;
      }

      if (ms < 1) {
        this.el.nativeElement.textContent = `${(ms * 1000).toFixed(0)}μs`;
      } else if (ms < 1000) {
        this.el.nativeElement.textContent = `${ms.toFixed(0)}ms`;
      } else {
        this.el.nativeElement.textContent = `${(ms / 1000).toFixed(1)}s`;
      }
    });
  }
}
