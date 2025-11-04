import type { TressiRequestConfig } from '../../types';
import type {
  EndpointRateLimitConfig,
  PerEndpointRateLimitConfig,
} from '../../types/rate-limit.types';
import { EndpointRateLimiter } from './endpoint-rate-limiter';

/**
 * Manages multiple EndpointRateLimiter instances for different endpoints.
 * Provides centralized rate limiting coordination across all endpoints.
 */
export class EndpointRateLimiterManager {
  private readonly limiters = new Map<string, EndpointRateLimiter>();
  private readonly globalConfig: PerEndpointRateLimitConfig;

  /**
   * Creates a new EndpointRateLimiterManager instance.
   * @param globalConfig Global rate limiting configuration
   */
  constructor(globalConfig: PerEndpointRateLimitConfig = {}) {
    this.globalConfig = {
      globalRps: globalConfig.globalRps ?? 0,
      defaultCapacity: globalConfig.defaultCapacity ?? 100,
      ...globalConfig,
    };
  }

  /**
   * Gets or creates a rate limiter for the specified endpoint.
   * @param endpoint The endpoint URL
   * @param requestConfig Optional request-specific configuration
   * @returns The endpoint rate limiter
   */
  getLimiter(
    endpoint: string,
    requestConfig?: TressiRequestConfig,
  ): EndpointRateLimiter {
    const existingLimiter = this.limiters.get(endpoint);
    if (existingLimiter) {
      return existingLimiter;
    }

    // Create new limiter based on configuration
    const endpointConfig = this.createEndpointConfig(endpoint, requestConfig);
    const limiter = new EndpointRateLimiter(endpoint, endpointConfig);

    this.limiters.set(endpoint, limiter);
    return limiter;
  }

  /**
   * Creates rate limiting configuration for an endpoint.
   * @param endpoint The endpoint URL
   * @param requestConfig Optional request-specific configuration
   * @returns Rate limiting configuration
   */
  private createEndpointConfig(
    endpoint: string,
    requestConfig?: TressiRequestConfig,
  ): EndpointRateLimitConfig {
    // Check if there's specific configuration for this endpoint
    const specificConfig = this.globalConfig.endpointLimits?.get(endpoint);

    // Use per-endpoint RPS if provided, otherwise use global RPS
    const rps =
      requestConfig?.rps ?? specificConfig?.rps ?? this.globalConfig.globalRps;

    return {
      rps: rps ?? 0,
      capacity:
        specificConfig?.capacity ?? this.globalConfig.defaultCapacity ?? 100,
      enabled: (rps ?? 0) > 0,
    };
  }

  /**
   * Updates rate limiting configuration for an endpoint.
   * @param endpoint The endpoint URL
   * @param config New rate limiting configuration
   */
  updateEndpointConfig(
    endpoint: string,
    config: EndpointRateLimitConfig,
  ): void {
    const limiter = this.limiters.get(endpoint);
    if (limiter) {
      limiter.updateConfig(config);
    } else {
      // Create new limiter with updated config
      const newLimiter = new EndpointRateLimiter(endpoint, config);
      this.limiters.set(endpoint, newLimiter);
    }
  }

  /**
   * Removes a rate limiter for an endpoint.
   * @param endpoint The endpoint URL
   */
  removeLimiter(endpoint: string): void {
    this.limiters.delete(endpoint);
  }

  /**
   * Gets all managed endpoints.
   * @returns Array of endpoint URLs
   */
  getManagedEndpoints(): string[] {
    return Array.from(this.limiters.keys());
  }

  /**
   * Resets all rate limiters to their initial state.
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Clears all rate limiters.
   */
  clear(): void {
    this.limiters.clear();
  }

  /**
   * Gets the current state of all rate limiters.
   * @returns Map of endpoint to token bucket state
   */
  getAllStates(): Map<string, ReturnType<EndpointRateLimiter['getState']>> {
    const states = new Map<
      string,
      ReturnType<EndpointRateLimiter['getState']>
    >();
    for (const [endpoint, limiter] of this.limiters) {
      states.set(endpoint, limiter.getState());
    }
    return states;
  }

  /**
   * Updates the global configuration.
   * @param config New global configuration
   */
  updateGlobalConfig(config: PerEndpointRateLimitConfig): void {
    this.globalConfig.globalRps =
      config.globalRps ?? this.globalConfig.globalRps;
    this.globalConfig.defaultCapacity =
      config.defaultCapacity ?? this.globalConfig.defaultCapacity;

    // Update endpoint-specific configurations if provided
    if (config.endpointLimits) {
      this.globalConfig.endpointLimits = config.endpointLimits;

      // Update existing limiters
      for (const [endpoint, endpointConfig] of config.endpointLimits) {
        this.updateEndpointConfig(endpoint, endpointConfig);
      }
    }
  }

  /**
   * Initializes rate limiters for a set of requests.
   * @param requests Array of request configurations
   */
  initializeForRequests(requests: TressiRequestConfig[]): void {
    for (const request of requests) {
      this.getLimiter(request.url, request);
    }
  }
}
