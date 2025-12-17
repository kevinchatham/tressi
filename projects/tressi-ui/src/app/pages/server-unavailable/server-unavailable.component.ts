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
  private readonly health = inject(HealthService);
  public readonly retryMessage = computed(() => this.health.getRetryMessage());
}
