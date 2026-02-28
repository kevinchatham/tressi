/**
 * Manages response body sampling for different endpoints and status codes.
 * This class ensures that we sample response bodies efficiently without
 * storing every response, which could be memory-intensive.
 */
export class ResponseSampler {
  private _responseSamplingSets: Map<string, Set<number>> = new Map();

  /**
   * Determines if a response body should be sampled for debugging purposes.
   *
   * @param method - The HTTP method used for the request
   * @param url - The request URL
   * @param statusCode - The response status code
   * @returns true if the response body should be sampled, false otherwise
   *
   * @remarks
   * Implements an efficient sampling strategy that captures the first occurrence
   * of each status code per endpoint. This provides representative samples
   * without the memory overhead of storing every response body.
   *
   * Uses endpoint specific tracking to ensure comprehensive coverage across
   * different endpoints while avoiding duplicate sampling of the same
   * status code for a given endpoint.
   *
   * @example
   * ```typescript
   * // First 200 response for /api/users -> sample (returns true)
   * // Second 200 response for /api/users -> skip (returns false)
   * // First 404 response for /api/users -> sample (returns true)
   * ```
   */
  shouldSampleResponse(
    method: string,
    url: string,
    statusCode: number,
  ): boolean {
    const endpointKey = this._getEndpointKey(method, url);
    const sampledCodesForEndpoint = this._getResponseSamplingSet(endpointKey);

    // Sample if we haven't seen this status code for this endpoint yet
    if (!sampledCodesForEndpoint.has(statusCode)) {
      sampledCodesForEndpoint.add(statusCode);
      return true;
    }

    return false;
  }

  /**
   * Gets or creates a Set for tracking sampled status codes per endpoint.
   *
   * @param endpointKey - Unique key identifying the endpoint (method + URL)
   * @returns Set of status codes that have been sampled for this endpoint
   *
   * @remarks
   * Implements lazy initialization to create tracking sets only for endpoints
   * that are actually encountered during testing. This optimizes memory usage
   * by avoiding pre-allocation for unused endpoints.
   */
  private _getResponseSamplingSet(endpointKey: string): Set<number> {
    let set = this._responseSamplingSets.get(endpointKey);
    if (!set) {
      set = new Set();
      this._responseSamplingSets.set(endpointKey, set);
    }
    return set;
  }

  /**
   * Generates a unique key for endpoint identification.
   *
   * @param method - The HTTP method
   * @param url - The request URL
   * @returns A unique key combining method and URL
   *
   * @remarks
   * Creates a consistent key format for endpoint tracking that distinguishes
   * between different HTTP methods on the same URL. This is important because
   * different methods (GET, POST, etc.) may have different response patterns
   * and should be tracked separately for sampling purposes.
   */
  private _getEndpointKey(method: string, url: string): string {
    return `${method} ${url}`;
  }
}
