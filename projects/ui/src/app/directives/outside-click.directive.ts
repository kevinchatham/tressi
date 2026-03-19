import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

/**
 * Directive that emits when a click occurs outside the host element.
 * Usage: <div (outsideClick)="handleOutsideClick()"></div>
 */
@Directive({
  selector: '[appOutsideClick]',
})
export class OutsideClickDirective {
  readonly outsideClick = output<void>();

  private _elementRef = inject(ElementRef);
  private _destroyRef = inject(DestroyRef);

  constructor() {
    fromEvent(document, 'click')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((event) => {
        const target = event.target as HTMLElement;
        const clickedInside = this._elementRef.nativeElement.contains(target);

        if (!clickedInside) {
          this.outsideClick.emit();
        }
      });
  }
}
