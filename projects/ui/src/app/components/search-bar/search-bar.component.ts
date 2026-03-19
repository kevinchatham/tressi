import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
})
export class SearchBarComponent {
  /** Input for the current search query */
  readonly query = input<string>('');

  /** Output event when the search query changes */
  readonly queryChange = output<string>();

  /**
   * Handles input changes and emits the new query
   */
  onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newQuery = target.value;
    this.queryChange.emit(newQuery);
  }
}
