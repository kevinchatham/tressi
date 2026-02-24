import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { logoSrc } from '../../constants';
import { HealthService } from '../../services/health.service';

@Component({
  selector: 'app-server-unavailable',
  imports: [],
  templateUrl: './server-unavailable.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerUnavailableComponent {
  private readonly _health = inject(HealthService);
  readonly retryMessage = computed(() => this._health.getRetryMessage());
  readonly logoSrc = logoSrc;
}
