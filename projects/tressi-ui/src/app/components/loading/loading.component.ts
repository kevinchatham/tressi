import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-loading',
  imports: [],
  templateUrl: './loading.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingComponent {
  show = input.required<boolean>();
  isVisible = signal(false);
  isFadingOut = signal(false);

  constructor() {
    effect(() => {
      const show = this.show();
      if (show) {
        this.isVisible.set(true);
        this.isFadingOut.set(false);
      } else {
        this.isFadingOut.set(true);
        // Wait for fade-out animation to complete before hiding
        setTimeout(() => {
          this.isVisible.set(false);
          this.isFadingOut.set(false);
        }, 300); // Match CSS transition duration
      }
    });
  }
}
