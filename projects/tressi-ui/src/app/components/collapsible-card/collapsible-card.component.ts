import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  contentChildren,
  input,
  output,
  TemplateRef,
} from '@angular/core';

import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-collapsible-card',
  imports: [ButtonComponent, NgTemplateOutlet],
  templateUrl: './collapsible-card.component.html',
  styleUrl: './collapsible-card.component.css',
})
export class CollapsibleCardComponent {
  readonly title = input.required<string>();
  readonly collapsed = input.required<boolean>();
  readonly collapsedChange = output<boolean>();

  readonly headerContent = contentChildren(TemplateRef);

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed());
  }
}
