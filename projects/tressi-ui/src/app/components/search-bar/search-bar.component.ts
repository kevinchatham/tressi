import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './search-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent {
  /** Input for the current search query */
  @Input()
  set query(value: string) {
    this.searchQuery.set(value);
  }
  get query(): string {
    return this.searchQuery();
  }

  /** Output event when the search query changes */
  @Output() queryChange = new EventEmitter<string>();

  /** Internal signal for search query state */
  readonly searchQuery = signal<string>('');

  /**
   * Handles input changes and emits the new query
   */
  onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newQuery = target.value;
    this.searchQuery.set(newQuery);
    this.queryChange.emit(newQuery);
  }
}
