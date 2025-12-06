import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, from, Observable, Subscription } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';

import { HealthState } from '../types';
import { LogService } from './log.service';
import { client, GetHealthResponse } from './rpc-client';

/**
 * Service responsible for monitoring the health of the backend server
 *
 * @description
 * This service provides continuous health monitoring for the backend server.
 * It performs periodic health checks and manages navigation to error pages
 * when the server becomes unavailable. The service uses Angular signals for
 * reactive state management and provides countdown functionality for retry attempts.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private healthService = inject(HealthService);
 *
 *   isHealthy = this.healthService.isHealthy();
 *   lastCheck = this.healthService.lastCheck();
 *   retryMessage = this.healthService.getRetryMessage();
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly log = inject(LogService);
  private readonly router = inject(Router);

  /** Interval between health checks in milliseconds (10 seconds) */
  private readonly healthCheckInterval = 10_000;

  /** Internal signal holding the current health state */
  private readonly state = signal<HealthState>({
    isHealthy: true,
    lastCheck: null,
    isChecking: false,
    error: null,
  });

  /** Signal indicating whether the server is currently healthy */
  public readonly isHealthy: Signal<boolean> = computed(
    () => this.state().isHealthy,
  );

  /** Signal containing the timestamp of the last health check */
  public readonly lastCheck: Signal<Date | null> = computed(
    () => this.state().lastCheck,
  );

  /** Signal indicating whether a health check is currently in progress */
  public readonly isChecking: Signal<boolean> = computed(
    () => this.state().isChecking,
  );

  /** Signal containing any error from the last health check */
  public readonly error: Signal<Error | null> = computed(
    () => this.state().error,
  );

  /** Signal containing the countdown seconds until the next health check */
  public readonly countdownSeconds = signal(0);

  private countdownSubscription?: Subscription;
  private remainingSeconds = 0;

  constructor() {
    this.startHealthMonitoring();
  }

  /**
   * Initializes the health monitoring system
   * @private
   */
  private startHealthMonitoring(): void {
    this.remainingSeconds = this.healthCheckInterval / 1000;
    this.countdownSeconds.set(this.remainingSeconds);
    this.startCountdown();
  }

  /**
   * Starts the countdown timer for the next health check
   * @private
   */
  private startCountdown(): void {
    this.countdownSubscription?.unsubscribe();

    const intervalId = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.countdownSeconds.set(this.remainingSeconds);
      } else {
        clearInterval(intervalId);
        this.performHealthCheck().subscribe({
          complete: () => {
            this.remainingSeconds = this.healthCheckInterval / 1000;
            this.countdownSeconds.set(this.remainingSeconds);
            this.startCountdown();
          },
        });
      }
    }, 1000);

    this.countdownSubscription = new Subscription(() =>
      clearInterval(intervalId),
    );
  }

  /**
   * Performs an actual health check against the backend server
   * @returns Observable that emits the health response
   * @private
   */
  private performHealthCheck(): Observable<GetHealthResponse> {
    this.state.update((s) => ({
      ...s,
      isChecking: true,
      lastCheck: new Date(),
    }));

    return from(client.health.$get().then((r) => r.json())).pipe(
      tap({
        next: (health: GetHealthResponse) => {
          const ok = health?.status === 'ok';
          this.updateHealthState(
            ok,
            ok ? null : new Error('Invalid health response'),
          );

          if (ok && this.router.url === '/server-unavailable') {
            this.log.info('Server recovered, redirecting to dashboard');
            this.router.navigate(['/']);
          }
        },
        error: (error) => {
          this.updateHealthState(false, error);
        },
      }),
      catchError(() => EMPTY),
      finalize(() => {
        this.state.update((s) => ({ ...s, isChecking: false }));
      }),
    );
  }

  /**
   * Updates the health state and handles navigation based on health status
   * @param isHealthy - Whether the server is healthy
   * @param error - Error object if health check failed
   * @private
   */
  private updateHealthState(isHealthy: boolean, error: Error | null): void {
    this.state.update((current) => {
      if (!isHealthy && this.router.url !== '/server-unavailable') {
        this.log.error('Server unavailable, redirecting to error page');
        this.router.navigate(['/server-unavailable']);
      }
      return { ...current, isHealthy, error };
    });
  }

  /**
   * Gets the formatted last check time as a locale string
   * @returns Formatted time string or 'Never' if no check has been performed
   */
  public getFormattedLastCheckTime(): string {
    const lastCheck = this.lastCheck();
    return lastCheck ? lastCheck.toLocaleTimeString() : 'Never';
  }

  /**
   * Gets a user-friendly retry message based on current state
   * @returns Message indicating when the next health check will occur
   */
  public getRetryMessage(): string {
    const countdown = this.countdownSeconds();
    if (this.isChecking()) return 'Checking now...';
    return countdown > 0
      ? `Next retry in ${countdown} second${countdown === 1 ? '' : 's'}...`
      : 'Next retry in 0 seconds...';
  }

  /**
   * Cleanup method to unsubscribe from countdown subscription
   * Called when the service is destroyed
   */
  public ngOnDestroy(): void {
    this.countdownSubscription?.unsubscribe();
  }
}
