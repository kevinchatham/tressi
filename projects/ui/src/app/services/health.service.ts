import { computed, Injectable, inject, type OnDestroy, type Signal, signal } from '@angular/core';
import type { ConnectedEventData } from '@tressi/shared/common';
import { AppRoutes } from '@tressi/shared/ui';
import type { Subscription } from 'rxjs';
import { EventService } from './event.service';
import { LogService } from './log.service';
import { AppRouterService } from './router.service';
import { RPCService } from './rpc.service';

/**
 * Service responsible for monitoring the health of the backend server using the unified event stream
 *
 * @description
 * This service provides realtime health monitoring for the backend server using the unified event stream.
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
export class HealthService implements OnDestroy {
  private readonly _log = inject(LogService);
  private readonly _appRouter = inject(AppRouterService);
  private readonly _eventService = inject(EventService);
  private readonly _rpc = inject(RPCService);

  /** Timeout for heartbeat in milliseconds (5 seconds) */
  private readonly _heartbeatTimeout = 5000;

  /** Interval for reconnection attempts in milliseconds (3 seconds) */
  private readonly _retryInterval = 3000;

  /** Internal signal holding the current health state */
  private readonly _state = signal<{
    isHealthy: boolean;
    lastCheck: Date | null;
    error: Error | null;
  }>({
    error: null,
    isHealthy: true,
    lastCheck: null,
  });

  /** Signal indicating whether the server is currently healthy */
  readonly isHealthy: Signal<boolean> = computed(() => this._state().isHealthy);

  /** Signal containing the timestamp of the last health check */
  readonly lastCheck: Signal<Date | null> = computed(() => this._state().lastCheck);

  private _heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _retryIntervalId: ReturnType<typeof setInterval> | null = null;
  private _subscription: Subscription | null = null;
  private _errorSubscription: Subscription | null = null;

  constructor() {
    this._subscribeToConnectedEvents();
  }

  /**
   * Initializes the health service by performing an initial health check.
   * Should be called via APP_INITIALIZER before the app starts.
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    await this.check();
  }

  /**
   * Manually checks the health of the backend server
   * @returns Promise resolving to true if healthy, false otherwise
   */
  async check(): Promise<boolean> {
    try {
      const response = await this._rpc.client.health.$get();

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      const data = await response.json();

      this._state.update((current) => ({
        ...current,
        error: null,
        isHealthy: true,
        lastCheck: new Date(data.timestamp),
      }));

      // If we were unhealthy and now we're healthy, trigger recovery
      this._handleRecovery();

      return true;
    } catch (error) {
      this._handleConnectionLoss(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    }
  }

  /**
   * Subscribes to connected events from the unified event stream
   * @private
   */
  private _subscribeToConnectedEvents(): void {
    this._subscription = this._eventService.getConnectedStream().subscribe({
      error: (error: unknown) => {
        this._log.error('Health monitoring subscription error', error);
        this._handleConnectionLoss();
      },
      next: (connectedEvent: ConnectedEventData) => {
        // Update health state
        this._state.update((current) => ({
          ...current,
          error: null,
          isHealthy: true,
          lastCheck: new Date(connectedEvent.timestamp),
        }));

        this._handleRecovery();
      },
    });

    this._errorSubscription = this._eventService.getErrorStream().subscribe({
      next: () => {
        this._handleConnectionLoss(new Error('Event stream connection lost'));
      },
    });
  }

  /**
   * Handles recovery when the server becomes available again
   * @private
   */
  private _handleRecovery(): void {
    if (!this.isHealthy()) return;

    // Stop retrying if we were in a retry loop
    this._stopRetryTimer();

    // Reset heartbeat timeout
    this._resetHeartbeatTimeout();

    // Only redirect if we are currently on the server unavailable page
    if (window.location.href.includes(AppRoutes.SERVER_UNAVAILABLE)) {
      this._log.info('Server recovered, resuming last session');
      this._appRouter.toLastRoute();
    }
  }

  /**
   * Resets the heartbeat timeout timer
   * @private
   */
  private _resetHeartbeatTimeout(): void {
    if (this._heartbeatTimeoutId) {
      clearTimeout(this._heartbeatTimeoutId);
    }

    this._heartbeatTimeoutId = setTimeout(() => {
      this._handleConnectionLoss();
    }, this._heartbeatTimeout);
  }

  /**
   * Handles connection loss and initiates reconnection
   * @param error Optional error that caused the connection loss
   * @private
   */
  private _handleConnectionLoss(error?: Error): void {
    // Update health state
    this._state.update((current) => ({
      ...current,
      error: error || new Error('Server connection lost'),
      isHealthy: false,
    }));

    // Navigate to server unavailable page if not already there
    if (!this._appRouter.getCurrentUrl().includes(AppRoutes.SERVER_UNAVAILABLE)) {
      this._log.error('Server unavailable, redirecting to error page');
      this._appRouter.toServerUnavailable();
    }

    // Start retrying to connect
    this._startRetryTimer();
  }

  /**
   * Starts the reconnection retry timer
   * @private
   */
  private _startRetryTimer(): void {
    if (this._retryIntervalId) return;

    this._log.info('Starting reconnection retry timer');
    this._retryIntervalId = setInterval(async () => {
      this._log.info('Attempting to reconnect to event stream...');
      this._eventService.connectToEventStream();

      // Fallback: also check health via HTTP in case SSE is stuck
      await this.check();
    }, this._retryInterval);
  }

  /**
   * Stops the reconnection retry timer
   * @private
   */
  private _stopRetryTimer(): void {
    if (this._retryIntervalId) {
      this._log.info('Stopping reconnection retry timer');
      clearInterval(this._retryIntervalId);
      this._retryIntervalId = null;
    }
  }

  /**
   * Gets the formatted last check time as a locale string
   * @returns Formatted time string or 'Never' if no check has been performed
   */
  getFormattedLastCheckTime(): string {
    const lastCheck = this.lastCheck();
    return lastCheck ? lastCheck.toLocaleTimeString() : 'Never';
  }

  /**
   * Gets a user-friendly retry message based on current state
   * @returns Message indicating connection status
   */
  getRetryMessage(): string {
    if (this.isHealthy()) {
      return 'Connecting...';
    }
    return 'Reconnecting...';
  }

  /**
   * Cleanup method to close subscriptions and clear timeouts
   * Called when the service is destroyed
   */
  ngOnDestroy(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }

    if (this._errorSubscription) {
      this._errorSubscription.unsubscribe();
      this._errorSubscription = null;
    }

    if (this._heartbeatTimeoutId) {
      clearTimeout(this._heartbeatTimeoutId);
      this._heartbeatTimeoutId = null;
    }

    this._stopRetryTimer();
  }
}
