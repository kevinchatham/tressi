import { Component, input, output } from '@angular/core';
import { ColumnConfig } from '@tressi/shared/ui';

import { OutsideClickDirective } from '../../../directives/outside-click.directive';
import { ButtonComponent } from '../../button/button.component';

@Component({
  selector: 'app-column-selector',
  imports: [ButtonComponent, OutsideClickDirective],
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
