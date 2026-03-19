import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { logoSrc } from '../../constants';
import { HealthService } from '../../services/health.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-server-unavailable',
  templateUrl: './server-unavailable.component.html',
})
export class ServerUnavailableComponent {
  private readonly _health = inject(HealthService);
  readonly retryMessage = computed(() => this._health.getRetryMessage());
  readonly logoSrc = logoSrc;
}
