import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';

import { ButtonComponent } from '../../../components/button/button.component';
import { CollapsibleCardComponent } from '../../../components/collapsible-card/collapsible-card.component';
import { JsonTextareaComponent } from '../../../components/json-textarea/json-textarea.component';
import { ToastService } from '../../../services/toast.service';

/**
 * Component for displaying test configuration details
 * Extracted from test-detail.component.html lines 78-104
 */
@Component({
  selector: 'app-config-details',
  imports: [
    CommonModule,
    ButtonComponent,
    CollapsibleCardComponent,
    JsonTextareaComponent,
  ],
  templateUrl: './config-details.component.html',
})
export class ConfigDetailsComponent {
  private readonly toastService = inject(ToastService);

  /** Configuration name to display */
  readonly configName = input<string>('Unknown Configuration');

  /** Configuration snapshot data */
  readonly configSnapshot = input<unknown>(null);

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(false);

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

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
      this.toastService.show('No configuration to copy', 'error');
      return;
    }

    try {
      const jsonString = JSON.stringify(snapshot, null, 2);
      await navigator.clipboard.writeText(jsonString);
      this.toastService.show('Configuration copied to clipboard', 'success');
    } catch {
      this.toastService.show('Failed to copy configuration', 'error');
    }
  }
}
