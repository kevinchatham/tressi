import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ConfigDocument } from '../../services/rpc.service';
import { TimeService } from '../../services/time.service';
import { ExportConfigButtonComponent } from '../export-config-button/export-config-button.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-configuration-card',
  standalone: true,
  imports: [IconComponent, ExportConfigButtonComponent],
  templateUrl: './configuration-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationCardComponent {
  readonly input = input.required<ConfigDocument>();

  /** Output events */
  readonly edit = output<ConfigDocument>();
  readonly duplicate = output<ConfigDocument>();
  readonly delete = output<ConfigDocument>();

  /** Services */
  readonly timeService = inject(TimeService);

  /** Expand/collapse state */
  readonly collapsed = signal(true);

  /** Toggle expand/collapse state */
  toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  /** Expand the card */
  expand(): void {
    this.collapsed.set(false);
  }

  /** Collapse the card */
  collapse(): void {
    this.collapsed.set(true);
  }

  /** Get headers entries as array */
  getHeadersEntries(): Array<[string, string]> {
    return Object.entries(this.input().config.options.headers);
  }

  /** Get headers count */
  getHeadersCount(): number {
    return Object.keys(this.input().config.options.headers).length;
  }
}
