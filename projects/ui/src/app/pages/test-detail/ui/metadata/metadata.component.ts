import { Component, inject, input, output, signal } from '@angular/core';
import { TestDocument } from '@tressi/shared/common';

import { ButtonComponent } from '../../../../components/button/button.component';
import { CollapsibleCardComponent } from '../../../../components/collapsible-card/collapsible-card.component';
import { IconComponent } from '../../../../components/icon/icon.component';
import { JsonTextareaComponent } from '../../../../components/json-textarea/json-textarea.component';
import { FormatDateDirective } from '../../../../directives/format/format-date.directive';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'app-metadata',
  imports: [
    ButtonComponent,
    CollapsibleCardComponent,
    IconComponent,
    JsonTextareaComponent,
    FormatDateDirective,
  ],
  templateUrl: './metadata.component.html',
})
export class MetadataComponent {
  private readonly _toastService = inject(ToastService);

  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

  /** Configuration name to display */
  readonly configName = input<string>('Unknown Configuration');

  /** Configuration snapshot data */
  readonly configSnapshot = input<unknown>(null);

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(true);

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

  /** Whether the configuration was recently copied */
  readonly copied = signal<boolean>(false);

  /**
   * Handle collapsed state change from collapsible card
   */
  onCollapsedChange(collapsed: boolean): void {
    this.collapsedChange.emit(collapsed);
  }

  /**
   * Copy the configuration snapshot to clipboard
   */
  async copyConfig(): Promise<void> {
    const snapshot = this.configSnapshot();
    if (!snapshot) {
      this._toastService.show('No configuration to copy', 'error');
      return;
    }

    try {
      const jsonString = JSON.stringify(snapshot, null, 2);
      await navigator.clipboard.writeText(jsonString);
      this._toastService.show('Configuration copied to clipboard', 'success');

      // Show success icon feedback
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this._toastService.show('Failed to copy configuration', 'error');
    }
  }
}
