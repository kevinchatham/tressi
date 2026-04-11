import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

@Directive({
  selector: '[appPreventNumberScroll]',
  standalone: true,
})
export class PreventNumberScrollDirective {
  private readonly _elementRef = inject(ElementRef<HTMLInputElement>);
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    fromEvent<WheelEvent>(this._elementRef.nativeElement, 'wheel', { passive: false })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => event.preventDefault());
  }
}
