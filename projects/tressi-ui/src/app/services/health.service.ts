import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { Router } from '@angular/router';

import { LogService } from './log.service';

interface HeartbeatMessage {
  status: string;
  timestamp: number;
}

/**
 * Service responsible for monitoring the health of the backend server using Server-Sent Events
 *
 * @description
 * This service provides real-time health monitoring for the backend server using SSE.
 * It establishes a persistent connection to receive heartbeat messages and detects
 * connection loss within 7 seconds. The service automatically handles reconnection
 * and navigation to error pages when the server becomes unavailable.
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

  /** Timeout for heartbeat in milliseconds (7 seconds) */
  private readonly heartbeatTimeout = 7000;

  /** Delay before attempting reconnection in milliseconds (3 seconds) */
  private readonly reconnectDelay = 3000;

  /** URL for the heartbeat SSE endpoint */
  private readonly heartbeatUrl = 'http://localhost:3108/api/health/heartbeat';

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

  private eventSource: EventSource | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;

  constructor() {
    this.connectToHeartbeat();
  }

  /**
   * Establishes connection to the heartbeat SSE endpoint
   * @private
   */
  private connectToHeartbeat(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(this.heartbeatUrl);

    this.eventSource.onopen = (): void => {
      this.log.info('Health monitoring connection established');
      this.isReconnecting = false;
      // If we were on the server-unavailable page and just reconnected
      if (this.router.url === '/server-unavailable') {
        this.log.info('Server recovered, redirecting to dashboard');
        this.router.navigate(['/']);
      }
    };

    this.eventSource.onmessage = (event: MessageEvent): void => {
      try {
        const heartbeat: HeartbeatMessage = JSON.parse(event.data);

        // Update health state
        this.state.update((current) => ({
          ...current,
          isHealthy: true,
          lastCheck: new Date(heartbeat.timestamp),
          error: null,
        }));

        // Reset heartbeat timeout
        this.resetHeartbeatTimeout();
      } catch (error) {
        this.log.error('Failed to parse heartbeat message', error);
      }
    };

    this.eventSource.onerror = (error: Event): void => {
      this.log.error('Health monitoring connection error', error);
      this.handleConnectionLoss();
    };
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
    this.isReconnecting = false; // Reset the flag at the start

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

    // Close existing connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Clear heartbeat timeout
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }

    // Schedule reconnection if not already reconnecting
    if (!this.isReconnecting) {
      this.scheduleReconnection();
    }
  }

  /**
   * Schedules automatic reconnection attempt
   * @private
   */
  private scheduleReconnection(): void {
    this.isReconnecting = true;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = setTimeout(() => {
      this.log.info('Attempting to reconnect to server...');
      this.connectToHeartbeat();
    }, this.reconnectDelay);
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
   * Cleanup method to close EventSource and clear timeouts
   * Called when the service is destroyed
   */
  public ngOnDestroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }
}
