import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
} from '@angular/core';

import { logoSrc } from '../../constants';

@Component({
  selector: 'app-loading',
  imports: [],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingComponent {
  readonly navigating = input<boolean>(false);
  readonly isFadingOut = signal(false);
  readonly shouldRender = signal(false);
  readonly logoSrc = logoSrc;

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
