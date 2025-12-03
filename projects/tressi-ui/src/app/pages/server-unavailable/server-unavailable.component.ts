import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { HealthService } from '../../services/health.service';

@Component({
  selector: 'app-server-unavailable',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './server-unavailable.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerUnavailableComponent {
  private readonly health = inject(HealthService);

  // Expose health service signals directly to template
  public readonly isChecking = this.health.isChecking;
  public readonly lastCheckTime = this.health.lastCheck;
  public readonly countdownSeconds = this.health.countdownSeconds;
  public readonly error = this.health.error;

  // Computed values for template
  public readonly formattedLastCheckTime = computed(() =>
    this.health.getFormattedLastCheckTime(),
  );

  public readonly retryMessage = computed(() => this.health.getRetryMessage());

  public readonly errorMessage = computed(() => {
    const error = this.error();
    return error?.message || 'Unable to connect to Tressi server';
  });
}
