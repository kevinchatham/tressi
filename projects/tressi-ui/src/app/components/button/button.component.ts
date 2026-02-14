import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

export const BUTTON_COLORS = [
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
] as const;

export type ButtonColor = (typeof BUTTON_COLORS)[number];

@Component({
  selector: 'app-button',
  imports: [IconComponent, CommonModule],
  templateUrl: './button.component.html',
  host: {
    '[style.pointer-events]': 'disabled() ? "none" : "auto"',
    class: 'contents',
  },
})
export class ButtonComponent {
  color = input<ButtonColor>('default');
  disabled = input<boolean>(false);
  ghost = input<boolean>(false);
  icon = input<IconName>();
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
      this.click.emit(event);
    }
  }
}
