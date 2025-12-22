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
  private tokens: number[];
  private lastRefill: number[];

  constructor(private endpoints: TressiRequestConfig[]) {
    this.tokens = new Array(endpoints.length).fill(0);
    this.lastRefill = new Array(endpoints.length).fill(Date.now());

    // Initialize with tokens to allow immediate requests
    for (let i = 0; i < endpoints.length; i++) {
      const rps = endpoints[i].rps || 1;
      this.tokens[i] = Math.min(rps, 10); // Start with up to 10 tokens
    }
  }

  /**
   * Gets available requests for immediate execution without blocking.
   *
   * @param batchSize - Maximum number of requests to return (default: 20)
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
   * const requests = limiter.getAvailableRequests(15);
   * // Returns up to 15 requests if tokens available
   * ```
   */
  getAvailableRequests(batchSize: number = 20): TressiRequestConfig[] {
    const now = Date.now();
    const available: TressiRequestConfig[] = [];

    for (
      let i = 0;
      i < this.endpoints.length && available.length < batchSize;
      i++
    ) {
      const elapsed = now - this.lastRefill[i];
      const rps = this.endpoints[i].rps || 1;
      const refill = Math.floor((elapsed / 1000) * rps);

      if (refill > 0) {
        this.tokens[i] = Math.min(this.tokens[i] + refill, rps * 2); // Allow burst
        this.lastRefill[i] = now;
      }

      while (this.tokens[i] >= 1 && available.length < batchSize) {
        this.tokens[i] -= 1;
        available.push(this.endpoints[i]);
      }
    }

    return available;
  }
}
