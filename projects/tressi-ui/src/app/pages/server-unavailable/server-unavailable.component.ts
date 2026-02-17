import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { HealthService } from '../../services/health.service';

@Component({
  selector: 'app-server-unavailable',
  imports: [],
  templateUrl: './server-unavailable.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerUnavailableComponent {
  readonly retryMessage = computed(() => this._health.getRetryMessage());
  private readonly _health = inject(HealthService);
}
