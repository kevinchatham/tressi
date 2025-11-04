import { performance } from 'perf_hooks';

import type {
  EndpointRateLimitConfig,
  TokenBucketState,
} from '../../types/rate-limit.types';

/**
 * Per-endpoint rate limiter using token bucket algorithm.
 * Provides non-blocking rate limiting for individual endpoints.
 */
export class EndpointRateLimiter {
  private tokens: number;
  private capacity: number;
  private refillRate: number;
  private lastRefillTime: number;
  private readonly endpoint: string;
  private config: EndpointRateLimitConfig;

  /**
   * Creates a new EndpointRateLimiter instance.
   * @param endpoint The endpoint URL this limiter is for
   * @param config Rate limiting configuration for this endpoint
   */
  constructor(endpoint: string, config: EndpointRateLimitConfig) {
    this.endpoint = endpoint;
    this.config = config;

    // Use provided capacity or calculate based on RPS (burst = 2x RPS)
    this.capacity = config.capacity ?? (config.rps ? config.rps * 2 : 100);
    this.refillRate = config.rps ?? 50;
    this.tokens = this.capacity;
    this.lastRefillTime = performance.now();
  }

  /**
   * Attempts to consume tokens from the bucket without blocking.
   * @param tokens Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if not enough tokens available
   */
  tryConsume(tokens: number = 1): boolean {
    if (!this.config.enabled && this.config.rps === undefined) {
      return true; // Rate limiting disabled for this endpoint
    }

    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Waits for tokens to be available and then consumes them.
   * Uses micro-delays instead of full sleep cycles for better performance.
   * @param tokens Number of tokens to consume (default: 1)
   * @returns Promise that resolves when tokens are consumed
   */
  async waitForTokens(tokens: number = 1): Promise<void> {
    if (!this.config.enabled && this.config.rps === undefined) {
      return; // Rate limiting disabled for this endpoint
    }

    while (!this.tryConsume(tokens)) {
      // Calculate exact wait time until next token is available
      const tokensNeeded = tokens - this.tokens;
      const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;

      // Use micro-delay to avoid blocking the event loop
      const delay = Math.max(0.1, Math.min(waitTimeMs, 5));
      await new Promise((resolve) => setTimeout(resolve, delay));

      this.refill();
    }
  }

  /**
   * Refills tokens based on elapsed time.
   */
  private refill(): void {
    const now = performance.now();
    const elapsedMs = now - this.lastRefillTime;
    const tokensToAdd = Math.floor((elapsedMs / 1000) * this.refillRate);

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Gets the current state of the token bucket.
   * @returns Current token bucket state
   */
  getState(): TokenBucketState {
    this.refill();
    return {
      availableTokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      lastRefillTime: this.lastRefillTime,
    };
  }

  /**
   * Gets the endpoint URL this limiter is for.
   * @returns The endpoint URL
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Updates the rate limiting configuration for this endpoint.
   * @param config New configuration
   */
  updateConfig(config: EndpointRateLimitConfig): void {
    this.config.rps = config.rps ?? this.config.rps;
    this.config.capacity = config.capacity ?? this.config.capacity;
    this.config.enabled = config.enabled ?? this.config.enabled;

    // Always update capacity if provided
    if (config.capacity !== undefined) {
      this.capacity = config.capacity;
      this.tokens = Math.min(this.tokens, this.capacity);
    }

    // Recalculate if RPS changed
    if (config.rps !== undefined) {
      this.refillRate = config.rps;
      this.capacity = config.capacity ?? config.rps * 2;
      this.tokens = Math.min(this.tokens, this.capacity);
    }
  }

  /**
   * Resets the token bucket to full capacity.
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = performance.now();
  }

  /**
   * Gets the current configuration.
   * @returns Current rate limiting configuration
   */
  getConfig(): EndpointRateLimitConfig {
    return { ...this.config };
  }
}
