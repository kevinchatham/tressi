import { CommonModule } from '@angular/common';
import {
  Component,
  contentChildren,
  input,
  output,
  TemplateRef,
} from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-collapsible-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './collapsible-card.component.html',
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
