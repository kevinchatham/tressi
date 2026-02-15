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
  navigating = input<boolean>(false);
  isFadingOut = signal(false);
  shouldRender = signal(false);

  constructor() {
    effect(() => {
      const navigating = this.navigating();
      if (navigating) {
        this.shouldRender.set(true);
        this.isFadingOut.set(false);
      } else {
        this.isFadingOut.set(true);
        // Wait for fade-out animation to complete before hiding
        setTimeout(() => {
          this.shouldRender.set(false);
          this.isFadingOut.set(false);
        }, 300); // Match CSS transition duration
      }
    });
  }
}
