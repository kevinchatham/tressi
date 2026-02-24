import { TressiRequestConfig } from '../common/config/types';

/**
 * WorkerRateLimiter - Token bucket rate limiter for controlling request throughput per endpoint.
 *
 * Implements a non-blocking token bucket algorithm that allows burst traffic while maintaining
 * target requests per second (RPS) rates. Designed for high-throughput load testing scenarios
 * where traditional blocking rate limiters would create bottlenecks.
 *
 * @example
 * ```typescript
 * const limiter = new WorkerRateLimiter(endpoints);
 * const requests = limiter.getAvailableRequests(20); // Get up to 20 available requests
 * // Process requests immediately without waiting
 * ```
 *
 * @remarks
 * The token bucket algorithm provides smooth rate limiting with the ability to handle
 * traffic bursts. Each endpoint gets its own token bucket with tokens replenished
 * based on the target RPS rate. The non-blocking design is critical for maintaining
 * high throughput in load testing scenarios.
 */
export class WorkerRateLimiter {
  private _tokens: number[];
  private _lastRefill: number[];
  private _rampUpDurationsSec: number[];

  constructor(
    private _endpoints: TressiRequestConfig[],
    globalRampUpDurationSec: number = 0,
  ) {
    this._tokens = new Array(_endpoints.length).fill(0);
    // Initialize to 0 so that elapsed time is calculated from testTimeElapsed
    this._lastRefill = new Array(_endpoints.length).fill(0);

    // Calculate effective ramp up duration for each endpoint
    // If endpoint value is 0, use global value
    this._rampUpDurationsSec = _endpoints.map(
      (endpoint) => endpoint.rampUpDurationSec || globalRampUpDurationSec,
    );
  }

  /**
   * Gets available requests for immediate execution without blocking.
   *
   * @param batchSize - Maximum number of requests to return (default: 20)
   * @param testTimeElapsed - Elapsed time in milliseconds since test started
   * @returns Array of endpoint configurations ready for execution
   *
   * @remarks
   * CRITICAL: This method is non-blocking and returns immediately with available requests.
   * Implements token bucket algorithm where tokens are replenished based on elapsed time
   * and target RPS rates. Allows burst traffic up to 2x the target RPS while maintaining
   * average rate over time.
   *
   * The algorithm:
   * 1. Calculates token replenishment based on elapsed time and RPS
   * 2. Caps token count at 2x RPS to allow bursts
   * 3. Returns available requests up to batch size limit
   * 4. Updates token counts for consumed requests
   *
   * This design enables high-throughput pipeline execution where workers can
   * process multiple requests concurrently without rate limiting bottlenecks.
   *
   * @example
   * ```typescript
   * // With endpoint RPS = 10 and 1 second elapsed:
   * // Tokens replenished: 10, max tokens: 20
   * const requests = limiter.getAvailableRequests(15, 1000);
   * // Returns up to 15 requests if tokens available
   * ```
   */
  getAvailableRequests(
    batchSize: number = 20,
    testTimeElapsed: number = 0,
  ): TressiRequestConfig[] {
    const available: TressiRequestConfig[] = [];

    for (
      let i = 0;
      i < this._endpoints.length && available.length < batchSize;
      i++
    ) {
      // Use testTimeElapsed for elapsed time calculation to support fake timers
      const elapsed = testTimeElapsed - this._lastRefill[i];

      const rps = this._calculateRps({
        targetRps: this._endpoints[i].rps,
        elapsedMs: testTimeElapsed,
        rampUpDurationSec: this._rampUpDurationsSec[i],
      });

      const refill = Math.floor((elapsed / 1000) * rps);

      if (refill > 0) {
        this._tokens[i] = Math.min(this._tokens[i] + refill, rps * 2); // Allow burst
        this._lastRefill[i] = testTimeElapsed;
      }

      while (this._tokens[i] >= 1 && available.length < batchSize) {
        this._tokens[i] -= 1;
        available.push(this._endpoints[i]);
      }
    }

    return available;
  }

  private _calculateRps(options: {
    targetRps: number;
    elapsedMs: number;
    rampUpDurationSec: number;
  }): number {
    const { targetRps, elapsedMs, rampUpDurationSec } = options;

    const rampUpDurationMs = rampUpDurationSec * 1000;

    const isWithinRampUp = elapsedMs < rampUpDurationMs;

    if (isWithinRampUp) {
      // Linear interpolation from 0 → targetRps
      const progress = elapsedMs / rampUpDurationMs;
      return targetRps * progress;
    }

    return targetRps;
  }
}
