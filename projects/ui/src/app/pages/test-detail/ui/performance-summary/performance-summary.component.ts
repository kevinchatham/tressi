import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import type { EndpointSummary, GlobalSummary, TestDocument } from '@tressi/shared/common';
import { METRIC_TOOLTIPS, type MetricState } from '@tressi/shared/ui';

import { CollapsibleCardComponent } from '../../../../components/collapsible-card/collapsible-card.component';
import { IconComponent } from '../../../../components/icon/icon.component';
import { FormatBytesDirective } from '../../../../directives/format/format-bytes.directive';
import { FormatCpuUsageDirective } from '../../../../directives/format/format-cpu.directive';
import { FormatLatencyDirective } from '../../../../directives/format/format-latency.directive';
import { FormatMemoryDirective } from '../../../../directives/format/format-memory.directive';
import { FormatNetworkThroughputDirective } from '../../../../directives/format/format-network.directive';
import { FormatNumberDirective } from '../../../../directives/format/format-number.directive';
import { FormatPercentageDirective } from '../../../../directives/format/format-percentage.directive';
import { FormatRpsDirective } from '../../../../directives/format/format-rps.directive';

@Component({
  imports: [
    CommonModule,
    CollapsibleCardComponent,
    IconComponent,
    FormatPercentageDirective,
    FormatRpsDirective,
    FormatNumberDirective,
    FormatBytesDirective,
    FormatNetworkThroughputDirective,
    FormatCpuUsageDirective,
    FormatMemoryDirective,
    FormatLatencyDirective,
  ],
  selector: 'app-performance-summary',
  templateUrl: './performance-summary.component.html',
})
export class PerformanceSummaryComponent {
  /** Selected summary (global or endpoint) */
  readonly selectedSummary = input<GlobalSummary | EndpointSummary | null | undefined>(null);

  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(false);

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

  /** Tooltip content mapping */
  tooltips = METRIC_TOOLTIPS;

  endpointSummary = computed<EndpointSummary | null>(() => {
    const s = this.selectedSummary();
    if (s && 'statusCodeDistribution' in s) return s as unknown as EndpointSummary;
    else return null;
  });

  globalSummary = computed<GlobalSummary | null>(() => {
    const s = this.selectedSummary();
    if (s && !('statusCodeDistribution' in s)) return s as unknown as GlobalSummary;
    else return null;
  });

  /**
   * Handle collapsed state change from collapsible card
   */
  onCollapsedChange(collapsed: boolean): void {
    this.collapsedChange.emit(collapsed);
  }

  /**
   * Determines CPU usage state based on percentage thresholds
   * - Good: < 70%
   * - Warning: 70-85%
   * - Error: > 85%
   */
  getCpuState(percent: number | undefined): MetricState {
    if (percent === undefined || percent === null) return 'good';

    if (percent > 85) return 'error';
    if (percent > 70) return 'warning';
    return 'good';
  }

  /**
   * Determines memory usage state based on MB thresholds
   * - Good: < 500MB
   * - Warning: 500-1000MB
   * - Error: > 1000MB
   */
  getMemoryState(mb: number | undefined): MetricState {
    if (mb === undefined || mb === null) return 'good';

    if (mb > 1000) return 'error';
    if (mb > 500) return 'warning';
    return 'good';
  }

  /**
   * Gets DaisyUI color classes for a metric state
   */
  getStateClasses(state: MetricState): { bg: string; text: string } {
    switch (state) {
      case 'error':
        return { bg: 'bg-error/20', text: 'text-error' };
      case 'warning':
        return { bg: 'bg-warning/20', text: 'text-warning' };
      default:
        return { bg: 'bg-success/20', text: 'text-success' };
    }
  }
}
