import { Component, computed, input, model, output } from '@angular/core';
import {
  type ButtonColor,
  type IconName,
  BUTTON_COLORS as SHARED_BUTTON_COLORS,
} from '@tressi/shared/ui';

import { IconComponent } from '../icon/icon.component';

export const BUTTON_COLORS: readonly [
  'primary',
  'secondary',
  'accent',
  'rainbow',
  'default',
  'neutral',
  'info',
  'success',
  'warning',
  'error',
] = SHARED_BUTTON_COLORS;

@Component({
  host: {
    '[attr.data-e2e]': 'dataE2e()',
    '[style.pointer-events]': 'disabled() ? "none" : "auto"',
    class: 'contents',
  },
  imports: [IconComponent],
  selector: 'app-button',
  styleUrl: './button.component.css',
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  dataE2e = input<string | undefined>(undefined, { alias: 'data-e2e' });
  color = input<ButtonColor>('default');
  disabled = input<boolean>(false);
  ghost = input<boolean>(false);
  icon = input<IconName>();
  secondaryIcon = input<IconName>();
  toggled = model<boolean>(false);
  tabindex = input<number>();
  title = input<string>();
  tooltip = input<string>();
  type = input<'submit' | 'button'>('button');
  click = output<Event>();

  buttonTitle = computed(() => this.tooltip() || this.title() || '');

  baseButtonClasses = computed<string[]>(() => {
    const classes = [
      'btn',
      'transition-all',
      'duration-500',
      'ease-in-out',
      'rounded-full',
      'p-2',
      'hover:p-4',
    ];

    if (this.ghost()) {
      classes.push('btn-ghost');
    } else {
      classes.push('btn-outline');
    }

    return classes;
  });

  primaryButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-primary'];
  });

  secondaryButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-secondary'];
  });

  accentButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-accent'];
  });

  rainbowButtonClasses = computed<string[]>(() => {
    if (this.disabled()) {
      return this.baseButtonClasses();
    } else if (this.ghost()) {
      return [...this.baseButtonClasses(), 'btn-rainbow-ghost'];
    } else {
      return [...this.baseButtonClasses(), 'btn-rainbow-outline'];
    }
  });

  neutralButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-neutral'];
  });

  infoButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-info'];
  });

  warningButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-warning'];
  });

  successButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-success'];
  });

  errorButtonClasses = computed<string[]>(() => {
    return [...this.baseButtonClasses(), 'btn-error'];
  });

  buttonClasses = computed<string[]>(() => {
    switch (this.color()) {
      case 'primary':
        return this.primaryButtonClasses();
      case 'secondary':
        return this.secondaryButtonClasses();
      case 'accent':
        return this.accentButtonClasses();
      case 'rainbow':
        return this.rainbowButtonClasses();
      case 'neutral':
        return this.neutralButtonClasses();
      case 'info':
        return this.infoButtonClasses();
      case 'success':
        return this.successButtonClasses();
      case 'warning':
        return this.warningButtonClasses();
      case 'error':
        return this.errorButtonClasses();
      case 'default':
        return this.baseButtonClasses();
    }
  });

  onClick(event: Event): void {
    event.stopPropagation();
    if (!this.disabled()) {
      if (this.secondaryIcon()) {
        this.toggled.set(!this.toggled());
      }
      this.click.emit(event);
    }
  }
}
