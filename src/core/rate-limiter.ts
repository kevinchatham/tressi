import { performance } from 'perf_hooks';

import type { TressiRequestConfig } from '../types';

/**
 * Tracks rate limiting for a single endpoint with microsecond precision
 */
export class EndpointRateTracker {
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly targetRPS: number;
  private readonly intervalMs: number;

  constructor(
    public readonly endpointKey: string,
    public readonly config: TressiRequestConfig,
  ) {
    this.targetRPS = config.rps || 1;
    this.intervalMs = 1000 / this.targetRPS;
  }

  /**
   * Gets the next allowed request time for this endpoint
   * @returns Timestamp when next request can be made, or 0 if ready now
   */
  getNextAllowedTime(): number {
    const now = performance.now();
    const nextTime = this.lastRequestTime + this.intervalMs;

    if (now >= nextTime) {
      return 0; // Ready now
    }

    return nextTime;
  }

  /**
   * Records a request execution
   */
  recordRequest(): void {
    this.lastRequestTime = performance.now();
    this.requestCount++;
  }

  /**
   * Gets current statistics for this endpoint
   */
  getStats(): {
    targetRPS: number;
    requestCount: number;
    lastRequestTime: number;
  } {
    return {
      targetRPS: this.targetRPS,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
    };
  }
}

/**
 * Centralized rate limiter that coordinates all endpoint requests
 * Replaces the worker-based rate limiting with precise timing control
 */
export class CentralizedRateLimiter {
  private endpointTrackers = new Map<string, EndpointRateTracker>();

  constructor(requests: TressiRequestConfig[]) {
    this.initializeEndpoints(requests);
  }

  private initializeEndpoints(requests: TressiRequestConfig[]): void {
    for (const request of requests) {
      const endpointKey = `${request.method}:${request.url}`;
      this.endpointTrackers.set(
        endpointKey,
        new EndpointRateTracker(endpointKey, request),
      );
    }
  }

  /**
   * Gets the next endpoint that can make a request
   * @returns The endpoint key and config for the next ready request, or null if none ready
   */
  getNextReadyEndpoint(): {
    endpointKey: string;
    config: TressiRequestConfig;
  } | null {
    let earliestTime = Infinity;

    // Find the endpoint with the earliest next allowed time
    for (const [endpointKey, tracker] of this.endpointTrackers) {
      const nextTime = tracker.getNextAllowedTime();

      if (nextTime === 0) {
        // This endpoint is ready now
        return {
          endpointKey,
          config: tracker.config,
        };
      }

      if (nextTime < earliestTime) {
        earliestTime = nextTime;
      }
    }

    // If no endpoint is ready, return null
    return null;
  }

  /**
   * Records that a request has been executed for an endpoint
   */
  recordRequest(endpointKey: string): void {
    const tracker = this.endpointTrackers.get(endpointKey);
    if (tracker) {
      tracker.recordRequest();
    }
  }

  /**
   * Gets the minimum wait time until the next request can be made
   * @returns Wait time in milliseconds, or 0 if a request can be made immediately
   */
  getMinWaitTime(): number {
    let minWait = Infinity;

    for (const tracker of this.endpointTrackers.values()) {
      const nextTime = tracker.getNextAllowedTime();
      if (nextTime === 0) {
        return 0;
      }
      minWait = Math.min(minWait, nextTime - performance.now());
    }

    return Math.max(0, minWait);
  }

  /**
   * Gets statistics for all endpoints
   */
  getStats(): Record<
    string,
    { targetRPS: number; requestCount: number; lastRequestTime: number }
  > {
    const stats: Record<
      string,
      { targetRPS: number; requestCount: number; lastRequestTime: number }
    > = {};

    for (const [endpointKey, tracker] of this.endpointTrackers) {
      stats[endpointKey] = tracker.getStats();
    }

    return stats;
  }

  /**
   * Updates the rate limiter with new configuration
   */
  updateEndpoints(requests: TressiRequestConfig[]): void {
    this.endpointTrackers.clear();
    this.initializeEndpoints(requests);
  }
}
