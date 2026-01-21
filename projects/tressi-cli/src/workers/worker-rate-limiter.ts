import { performance } from 'perf_hooks';

import { TressiRequestConfig } from '../common/config/types';

/**
 * WorkerRateLimiter - Time-based rate limiter for controlling request throughput per endpoint.
 *
 * Implements a time-based calculation approach that provides smooth, precise rate limiting
 * with support for linear ramp-up. Replaces token bucket algorithm for better timing accuracy
 * and predictable ramp-up behavior.
 */
export class WorkerRateLimiter {
  private lastExecutionTime: number[];
  private remainder: number[];
  private startTime: number;

  constructor(private endpoints: TressiRequestConfig[]) {
    this.startTime = performance.now();
    this.lastExecutionTime = new Array(endpoints.length).fill(this.startTime);
    // CRITICAL: Initialize with 0 remainder for true ramp-up from 0
    this.remainder = new Array(endpoints.length).fill(0);
  }

  /**
   * Calculate current RPS based on linear ramp-up progress
   * Returns floating-point value for fractional request tracking
   */
  private getCurrentRps(index: number, elapsedMs: number): number {
    const endpoint = this.endpoints[index];
    const rampUpDuration = (endpoint.rampUpDurationSec || 0) * 1000;

    if (rampUpDuration <= 0) {
      return endpoint.rps || 1;
    }

    if (elapsedMs >= rampUpDuration) {
      return endpoint.rps || 1;
    }

    // Linear ramp from 0 to target RPS (floating-point for accuracy)
    const progress = elapsedMs / rampUpDuration;
    const targetRps = endpoint.rps || 1;

    // Return fractional RPS to enable smooth ramp-up at any rate
    // Example: RPS=1 at 50% ramp-up = 0.5 RPS, accumulating 1 request every 2 seconds
    return Math.max(0, targetRps * progress);
  }

  /**
   * Get available requests based on elapsed time calculation.
   * Uses high-resolution timing for precise rate control.
   */
  getAvailableRequests(batchSize: number = 20): TressiRequestConfig[] {
    const now = performance.now();
    const available: TressiRequestConfig[] = [];
    const elapsedMs = now - this.startTime;

    for (
      let i = 0;
      i < this.endpoints.length && available.length < batchSize;
      i++
    ) {
      const currentRps = this.getCurrentRps(i, elapsedMs);

      // Allow very small RPS values to accumulate (critical for low RPS ramp-up)
      if (currentRps < 0.001) {
        continue; // No requests during initial ramp-up phase
      }

      // Special case: for first call, allow requests based on current RPS
      const isFirstCall = this.lastExecutionTime[i] === this.startTime;

      if (isFirstCall) {
        // For first call, allow requests based on current RPS (handles both ramp-up and no ramp-up)
        const requestsToAdd = Math.min(
          Math.floor(currentRps),
          batchSize - available.length,
        );
        for (let j = 0; j < requestsToAdd; j++) {
          available.push(this.endpoints[i]);
        }
        this.lastExecutionTime[i] = now;
        continue;
      }

      // Calculate how many requests should have been sent by now
      const timeSinceLastExecution = now - this.lastExecutionTime[i];
      const requestsNeeded =
        (timeSinceLastExecution / 1000) * currentRps + this.remainder[i];

      const wholeRequests = Math.floor(requestsNeeded);
      let remainder = requestsNeeded - wholeRequests; // Start with fractional remainder

      if (wholeRequests > 0) {
        let addedCount = 0;
        // Add requests to available batch
        for (
          let j = 0;
          j < wholeRequests && available.length < batchSize;
          j++
        ) {
          available.push(this.endpoints[i]);
          addedCount++;
        }

        // CRITICAL FIX: Add un-added whole requests back to remainder
        if (addedCount < wholeRequests) {
          remainder += wholeRequests - addedCount;
        }

        this.remainder[i] = remainder;
        this.lastExecutionTime[i] = now;
      } else {
        this.remainder[i] = remainder;
      }
    }

    return available;
  }
}
