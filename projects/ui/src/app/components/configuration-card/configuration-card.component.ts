import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ConfigDocument, TressiRequestConfig } from '@tressi/shared/common';

import { FormatDurationDirective } from '../../directives/format/format-duration.directive';
import { FormatNumberDirective } from '../../directives/format/format-number.directive';
import { FormatRpsDirective } from '../../directives/format/format-rps.directive';
import { TimeService } from '../../services/time.service';
import { ButtonComponent } from '../button/button.component';
import { CollapsibleCardComponent } from '../collapsible-card/collapsible-card.component';
import { ExportConfigButtonComponent } from '../export-config-button/export-config-button.component';

@Component({
  selector: 'app-configuration-card',
  imports: [
    ExportConfigButtonComponent,
    ButtonComponent,
    FormatNumberDirective,
    FormatRpsDirective,
    FormatDurationDirective,
    CollapsibleCardComponent,
  ],
  templateUrl: './configuration-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationCardComponent {
  readonly input = input.required<ConfigDocument>();

  /** Output events */
  readonly edit = output<ConfigDocument>();
  readonly duplicate = output<ConfigDocument>();
  readonly delete = output<ConfigDocument>();
  readonly navigate = output<ConfigDocument>();

  /** Services */
  readonly timeService = inject(TimeService);

  /** Expand/collapse state */
  readonly collapsed = signal(true);

  /**
   * Toggles the collapsed state of the card.
   * Uses the View Transitions API if available for smooth layout changes.
   */
  toggleCollapsed(isCollapsed: boolean): void {
    if (!document.startViewTransition) {
      this.collapsed.set(isCollapsed);
      return;
    }

    document.startViewTransition(() => {
      this.collapsed.set(isCollapsed);
    });
  }

  /** Check if request has payload */
  hasPayload(request: TressiRequestConfig): boolean {
    return (
      request.payload &&
      (Array.isArray(request.payload)
        ? request.payload.length > 0
        : Object.keys(request.payload).length > 0)
    );
  }

  /** Get the effective ramp up duration (max of global and any endpoint ramp up) */
  getEffectiveRampUpDuration(): number {
    const globalRampUp = this.input().config.options.rampUpDurationSec || 0;
    const maxEndpointRampUp = Math.max(
      ...this.input().config.requests.map((req) => req.rampUpDurationSec || 0),
    );
    return Math.max(globalRampUp, maxEndpointRampUp);
  }

  /** Get total number of endpoints */
  getTotalEndpoints(): number {
    return this.input().config.requests.length;
  }

  /** Get total RPS across all endpoints */
  getTotalRPS(): number {
    return this.input().config.requests.reduce(
      (sum, req) => sum + (req.rps || 0),
      0,
    );
  }

  /** Get effective early exit status (enabled if any endpoint or global has it enabled) */
  getEffectiveEarlyExitStatus(): boolean {
    const globalEarlyExit = this.input().config.options.workerEarlyExit.enabled;
    const anyEndpointEarlyExit = this.input().config.requests.some(
      (req) => req.earlyExit.enabled,
    );
    return globalEarlyExit || anyEndpointEarlyExit;
  }
}
