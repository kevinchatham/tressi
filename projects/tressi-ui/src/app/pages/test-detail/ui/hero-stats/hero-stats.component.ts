import { Component, computed, inject, input } from '@angular/core';

import { FormatDurationDirective } from '../../../../directives/format/format-duration.directive';
import { FormatLatencyDirective } from '../../../../directives/format/format-latency.directive';
import { FormatPercentageDirective } from '../../../../directives/format/format-percentage.directive';
import { FormatRpsDirective } from '../../../../directives/format/format-rps.directive';
import {
  EndpointSummary,
  GlobalSummary,
  TestDocument,
} from '../../../../services/rpc.service';
import { TestService } from '../../../../services/test.service';

@Component({
  selector: 'app-hero-stats',
  imports: [
    FormatDurationDirective,
    FormatPercentageDirective,
    FormatRpsDirective,
    FormatLatencyDirective,
  ],
  templateUrl: './hero-stats.component.html',
})
export class HeroStatsComponent {
  private readonly _testService = inject(TestService);

  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

  /** Selected summary (global or endpoint) */
  readonly selectedSummary = input<GlobalSummary | EndpointSummary | null>(
    null,
  );

  /** Whether the test is running in real-time */
  readonly isRealTime = input<boolean>(false);

  /** Selected endpoint URL or 'global' */
  readonly selectedEndpoint = input<string>('global');

  /**
   * Computed success rate percentage
   */
  readonly successRate = computed(() => {
    const summary = this.selectedSummary();
    if (!summary) return 0;
    return 100 - (summary.errorRate || 0) * 100;
  });

  /**
   * Get test duration in seconds
   */
  getDurationSec(): number | null {
    const test = this.testData();
    if (!test) return null;

    return this._testService.getTestDuration(test) / 1000;
  }
}
