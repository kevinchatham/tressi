import { Directive, effect, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appFormatDuration]',
})
export class FormatDurationDirective {
  private readonly el = inject(ElementRef);
  readonly value = input<number | undefined | null>(undefined, {
    alias: 'appFormatDuration',
  });

  constructor() {
    effect(() => {
      const seconds = this.value();
      if (seconds === undefined || seconds === null || seconds === 0) {
        this.el.nativeElement.textContent = '0s';
        return;
      }

      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

      this.el.nativeElement.textContent = parts.join(' ');
    });
  }
}
