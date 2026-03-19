import { Component, input, output } from '@angular/core';
import type { ColumnConfig } from '@tressi/shared/ui';

import { OutsideClickDirective } from '../../../directives/outside-click.directive';
import { ButtonComponent } from '../../button/button.component';

@Component({
  imports: [ButtonComponent, OutsideClickDirective],
  selector: 'app-column-selector',
  templateUrl: './column-selector.component.html',
})
export class ColumnSelectorComponent {
  columnGroups = input.required<Record<string, ColumnConfig[]>>();
  showColumnSelector = input.required<boolean>();

  toggleColumn = output<string>();
  resetColumns = output<void>();
  toggleSelector = output<void>();
  closeSelector = output<void>();

  onToggleColumn(key: string): void {
    this.toggleColumn.emit(key);
  }

  onResetColumns(): void {
    this.resetColumns.emit();
  }

  onToggleSelector(): void {
    this.toggleSelector.emit();
  }

  onCloseSelector(): void {
    this.closeSelector.emit();
  }
}
