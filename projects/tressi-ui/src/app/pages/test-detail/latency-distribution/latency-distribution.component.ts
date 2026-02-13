import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { CollapsibleCardComponent } from '../../../components/collapsible-card/collapsible-card.component';
import { LatencyHistogram } from '../../../services/rpc.service';
import { LatencyHistogramComponent } from '../latency-histogram/latency-histogram.component';

@Component({
  selector: 'app-latency-distribution',
  imports: [CommonModule, CollapsibleCardComponent, LatencyHistogramComponent],
  templateUrl: './latency-distribution.component.html',
})
export class LatencyDistributionComponent {
  /** Histogram data */
  readonly histogram = input<LatencyHistogram | undefined>();

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
