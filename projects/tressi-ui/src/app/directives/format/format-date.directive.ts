import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatDate]',
})
export class FormatDateDirective {
  private readonly el = inject(ElementRef);
  readonly value = input<number | string | Date | undefined | null>(undefined, {
    alias: 'appFormatDate',
  });

  constructor() {
    effect(() => {
      const dateValue = this.value();
      if (!dateValue) {
        this.el.nativeElement.textContent = '—';
        return;
      }

      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          this.el.nativeElement.textContent = '—';
          return;
        }
        this.el.nativeElement.textContent = date.toLocaleString();
      } catch {
        this.el.nativeElement.textContent = '—';
      }
    });
  }
}
