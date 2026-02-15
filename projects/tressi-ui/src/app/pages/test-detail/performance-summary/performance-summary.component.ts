import { Component, input, output } from '@angular/core';

import { CollapsibleCardComponent } from '../../../components/collapsible-card/collapsible-card.component';
import { EndpointSummary, GlobalSummary } from '../../../services/rpc.service';
import { TestDocument } from '../../../services/rpc.service';
import { MetricsSummaryComponent } from '../metrics-summary/metrics-summary.component';

/**
 * Component for displaying performance summary with endpoint selector
 * Extracted from test-detail.component.html lines 272-299
 */
@Component({
  selector: 'app-performance-summary',
  imports: [CollapsibleCardComponent, MetricsSummaryComponent],
  templateUrl: './performance-summary.component.html',
})
export class PerformanceSummaryComponent {
  /** Selected summary (global or endpoint) */
  readonly selectedSummary = input<
    GlobalSummary | EndpointSummary | null | undefined
  >(null);

  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

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
