/**
 * Rate limiting configuration for individual endpoints
 */
export interface EndpointRateLimitConfig {
  /** Maximum requests per second for this endpoint */
  rps?: number;
  /** Token bucket capacity (burst size) */
  capacity?: number;
  /** Whether to enable rate limiting for this endpoint */
  enabled?: boolean;
}

/**
 * Configuration for endpoint-specific rate limiting
 */
export interface PerEndpointRateLimitConfig {
  /** Global RPS limit used when per-endpoint config is not specified */
  globalRps?: number;
  /** Map of endpoint URLs to their specific rate limits */
  endpointLimits?: Map<string, EndpointRateLimitConfig>;
  /** Default capacity for token buckets when not specified */
  defaultCapacity?: number;
}

/**
 * Token bucket state for monitoring
 */
export interface TokenBucketState {
  /** Current available tokens */
  availableTokens: number;
  /** Maximum capacity of the bucket */
  capacity: number;
  /** Current refill rate (tokens per second) */
  refillRate: number;
  /** Last time the bucket was refilled */
  lastRefillTime: number;
}

/**
 * Rate limiting statistics for monitoring
 */
export interface RateLimitStats {
  /** Number of requests allowed */
  allowedRequests: number;
  /** Number of requests delayed due to rate limiting */
  delayedRequests: number;
  /** Number of requests rejected (if hard limiting is enabled) */
  rejectedRequests: number;
  /** Average wait time for rate limited requests */
  averageWaitTimeMs: number;
}
