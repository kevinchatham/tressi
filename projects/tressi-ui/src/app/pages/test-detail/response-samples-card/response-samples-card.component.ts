import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { CollapsibleCardComponent } from '../../../components/collapsible-card/collapsible-card.component';
import { ResponseSamplesComponent } from '../response-samples/response-samples.component';

@Component({
  selector: 'app-response-samples-card',
  imports: [CommonModule, CollapsibleCardComponent, ResponseSamplesComponent],
  templateUrl: './response-samples-card.component.html',
})
export class ResponseSamplesCardComponent {
  /** Response samples data */
  readonly responseSamples = input<any[] | undefined>();

  /** Status code distribution data */
  readonly statusCodeDistribution = input<Record<string, number> | undefined>();

  /** Total requests count */
  readonly totalRequests = input<number | undefined>();

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
}
