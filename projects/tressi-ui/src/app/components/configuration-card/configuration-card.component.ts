import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ModifyConfigRequest } from '../../services/rpc.service';
import { TimeService } from '../../services/time.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-configuration-card',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './configuration-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationCardComponent {
  /** Required configuration input */
  readonly config = input.required<ModifyConfigRequest>();

  /** Output events */
  readonly edit = output<ModifyConfigRequest>();
  readonly delete = output<ModifyConfigRequest>();

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
    return Object.entries(this.config().config.options.headers);
  }

  /** Get headers count */
  getHeadersCount(): number {
    return Object.keys(this.config().config.options.headers).length;
  }
}
