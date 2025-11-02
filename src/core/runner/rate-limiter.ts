import { performance } from 'perf_hooks';

/**
 * Manages rate limiting for HTTP requests during load testing.
 * This class provides rate control mechanisms to achieve target requests per second.
 */
export class RateLimiter {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private windowStartTime: number = 0;
  private windowSizeMs: number = 1000; // 1 second window

  /**
   * Creates a new RateLimiter instance.
   * @param windowSizeMs Optional window size in milliseconds (default: 1000ms)
   */
  constructor(windowSizeMs?: number) {
    if (windowSizeMs) {
      this.windowSizeMs = windowSizeMs;
    }
    this.reset();
  }

  /**
   * Waits for the appropriate time before making the next request.
   * @param targetRps Target requests per second
   * @param workerCount Number of workers (for distributed rate limiting)
   * @returns Promise that resolves when it's time to make the next request
   */
  async waitForNextRequest(
    targetRps: number,
    workerCount: number = 1,
  ): Promise<void> {
    if (targetRps <= 0 || workerCount <= 0) {
      // No rate limiting needed
      return;
    }

    const now = performance.now();

    // Calculate delay for the entire batch based on target RPS and worker count
    const batchDelay = (1000 * workerCount) / targetRps;

    // Calculate time since last request
    const timeSinceLastRequest = now - this.lastRequestTime;

    // If we need to wait, sleep for the remaining time
    if (timeSinceLastRequest < batchDelay) {
      const sleepTime = batchDelay - timeSinceLastRequest;
      await this.sleep(sleepTime);
    }

    this.lastRequestTime = performance.now();
    this.requestCount++;
  }

  /**
   * Yields control to the event loop without rate limiting.
   * @returns Promise that resolves after yielding
   */
  async yield(): Promise<void> {
    await this.sleep(0);
  }

  /**
   * Sleeps for the specified number of milliseconds.
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after the sleep duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Resets the rate limiter state.
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStartTime = performance.now();
  }

  /**
   * Gets the current request count in the current window.
   * @returns Number of requests in the current window
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Gets the current requests per second rate.
   * @returns Current RPS rate
   */
  getCurrentRps(): number {
    const now = performance.now();
    const windowDuration = now - this.windowStartTime;

    if (windowDuration >= this.windowSizeMs) {
      // Start a new window
      this.reset();
      this.windowStartTime = now;
      return 0;
    }

    return (this.requestCount * 1000) / windowDuration;
  }

  /**
   * Checks if the rate limit has been exceeded.
   * @param targetRps Target requests per second
   * @returns true if rate limit exceeded
   */
  isRateLimitExceeded(targetRps: number): boolean {
    return this.getCurrentRps() > targetRps;
  }

  /**
   * Gets the time until the next request can be made.
   * @param targetRps Target requests per second
   * @returns Time in milliseconds until next request
   */
  getTimeUntilNextRequest(targetRps: number): number {
    if (targetRps <= 0) {
      return 0;
    }

    const now = performance.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const requiredDelay = 1000 / targetRps;

    if (timeSinceLastRequest >= requiredDelay) {
      return 0;
    }

    return requiredDelay - timeSinceLastRequest;
  }

  /**
   * Updates the window size for rate limiting.
   * @param windowSizeMs New window size in milliseconds
   */
  setWindowSize(windowSizeMs: number): void {
    this.windowSizeMs = windowSizeMs;
    this.reset();
  }

  /**
   * Gets the current window size.
   * @returns Current window size in milliseconds
   */
  getWindowSize(): number {
    return this.windowSizeMs;
  }
}

/**
 * Token bucket rate limiter for more sophisticated rate limiting.
 * This implementation uses a token bucket algorithm for smoother rate limiting.
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefillTime: number;

  /**
   * Creates a new TokenBucketRateLimiter instance.
   * @param capacity Maximum number of tokens in the bucket
   * @param refillRate Number of tokens to refill per second
   */
  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefillTime = performance.now();
  }

  /**
   * Attempts to consume a token from the bucket.
   * @param tokens Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if not enough tokens available
   */
  tryConsume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Waits for tokens to be available and then consumes them.
   * @param tokens Number of tokens to consume (default: 1)
   * @returns Promise that resolves when tokens are consumed
   */
  async waitForTokens(tokens: number = 1): Promise<void> {
    while (!this.tryConsume(tokens)) {
      // Calculate wait time until next token is available
      const tokensNeeded = tokens - this.tokens;
      const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(waitTimeMs, 100)),
      );
      this.refill();
    }
  }

  /**
   * Refills tokens based on elapsed time.
   */
  private refill(): void {
    const now = performance.now();
    const elapsedMs = now - this.lastRefillTime;
    const tokensToAdd = (elapsedMs / 1000) * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Gets the current number of available tokens.
   * @returns Current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Gets the bucket capacity.
   * @returns Maximum token capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Gets the refill rate.
   * @returns Tokens refilled per second
   */
  getRefillRate(): number {
    return this.refillRate;
  }

  /**
   * Resets the token bucket to full capacity.
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = performance.now();
  }
}
