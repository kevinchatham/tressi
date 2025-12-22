import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { EventService } from './event.service';
import { LogService } from './log.service';

/**
 * Service responsible for monitoring the health of the backend server using the unified event stream
 *
 * @description
 * This service provides real-time health monitoring for the backend server using the unified event stream.
 * It receives connected events from the EventService and detects connection loss within 5 seconds.
 * The service automatically handles reconnection and navigation to error pages when the server becomes unavailable.
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
  private readonly eventService = inject(EventService);

  /** Timeout for heartbeat in milliseconds (5 seconds) */
  private readonly heartbeatTimeout = 5000;

  /** Internal signal holding the current health state */
  private readonly state = signal<{
    isHealthy: boolean;
    lastCheck: Date | null;
    error: Error | null;
  }>({
    isHealthy: true,
    lastCheck: null,
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

  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscription: Subscription | null = null;

  constructor() {
    this.subscribeToConnectedEvents();
  }

  /**
   * Subscribes to connected events from the unified event stream
   * @private
   */
  private subscribeToConnectedEvents(): void {
    this.subscription = this.eventService.getConnectedStream().subscribe({
      next: (connectedEvent) => {
        this.log.info('Health monitoring connection established');

        // Update health state
        this.state.update((current) => ({
          ...current,
          isHealthy: true,
          lastCheck: new Date(connectedEvent.timestamp),
          error: null,
        }));

        // If we were on the server-unavailable page and just reconnected
        if (this.router.url === '/server-unavailable') {
          this.log.info('Server recovered, redirecting to dashboard');
          this.router.navigate(['/']);
        }

        // Reset heartbeat timeout
        this.resetHeartbeatTimeout();
      },
      error: (error) => {
        this.log.error('Health monitoring subscription error', error);
        this.handleConnectionLoss();
      },
    });
  }

  /**
   * Resets the heartbeat timeout timer
   * @private
   */
  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }

    this.heartbeatTimeoutId = setTimeout(() => {
      this.handleConnectionLoss();
    }, this.heartbeatTimeout);
  }

  /**
   * Handles connection loss and initiates reconnection
   * @private
   */
  private handleConnectionLoss(): void {
    // Update health state
    this.state.update((current) => ({
      ...current,
      isHealthy: false,
      error: new Error('Server connection lost'),
    }));

    // Navigate to server unavailable page if not already there
    if (this.router.url !== '/server-unavailable') {
      this.log.error('Server unavailable, redirecting to error page');
      this.router.navigate(['/server-unavailable']);
    }
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
   * @returns Message indicating connection status
   */
  public getRetryMessage(): string {
    if (this.isHealthy()) {
      return 'Connecting...';
    }
    return 'Reconnecting...';
  }

  /**
   * Cleanup method to close subscriptions and clear timeouts
   * Called when the service is destroyed
   */
  public ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }
}
