import { Component, computed, inject, input } from '@angular/core';
import type { EndpointSummary, GlobalSummary, TestDocument } from '@tressi/shared/common';

import { FormatDurationDirective } from '../../../../directives/format/format-duration.directive';
import { FormatLatencyDirective } from '../../../../directives/format/format-latency.directive';
import { FormatPercentageDirective } from '../../../../directives/format/format-percentage.directive';
import { FormatRpsDirective } from '../../../../directives/format/format-rps.directive';
import { TestService } from '../../../../services/test.service';

@Component({
  imports: [
    FormatDurationDirective,
    FormatPercentageDirective,
    FormatRpsDirective,
    FormatLatencyDirective,
  ],
  selector: 'app-hero-stats',
  templateUrl: './hero-stats.component.html',
})
export class HeroStatsComponent {
  private readonly _testService = inject(TestService);

  /** Test data document */
  readonly testData = input<TestDocument | null>(null);

  /** Selected summary (global or endpoint) */
  readonly selectedSummary = input<GlobalSummary | EndpointSummary | null>(null);

  /** Whether the test is running in realtime */
  readonly isRealTime = input<boolean>(false);

  /** Selected endpoint URL or 'global' */
  readonly selectedEndpoint = input<string>('global');

  /**
   * Computed target achieved percentage
   */
  readonly targetAchievedPercentage = computed(() => {
    const summary = this.selectedSummary();
    if (!summary) return 0;
    return summary.targetAchieved;
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
