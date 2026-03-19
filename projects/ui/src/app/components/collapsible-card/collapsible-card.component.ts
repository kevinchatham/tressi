import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChildren, input, output, TemplateRef } from '@angular/core';
import type { IconName } from '@tressi/shared/ui';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  imports: [ButtonComponent, NgTemplateOutlet, IconComponent],
  selector: 'app-collapsible-card',
  styleUrl: './collapsible-card.component.css',
  templateUrl: './collapsible-card.component.html',
})
export class CollapsibleCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<IconName>();
  readonly collapsed = input.required<boolean>();
  readonly collapsedChange = output<boolean>();

  readonly headerContent = contentChildren(TemplateRef);

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed());
  }
}
