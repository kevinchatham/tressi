/**
 * Manages response body sampling for different endpoints and status codes.
 * This class ensures that we sample response bodies efficiently without
 * storing every response, which could be memory-intensive.
 */
export class ResponseSampler {
  private responseSamplingSets: Map<string, Set<number>>;

  constructor(private maxSamplesPerEndpoint: number = 100) {
    this.responseSamplingSets = new Map();
  }

  /**
   * Determines if a response body should be sampled for a given endpoint and status code.
   * @param method The HTTP method
   * @param url The request URL
   * @param statusCode The response status code
   * @returns true if the response body should be sampled
   */
  shouldSampleResponse(
    method: string,
    url: string,
    statusCode: number,
  ): boolean {
    const endpointKey = this.getEndpointKey(method, url);
    const sampledCodesForEndpoint = this.getResponseSamplingSet(endpointKey);

    // Sample if we haven't seen this status code for this endpoint yet
    if (!sampledCodesForEndpoint.has(statusCode)) {
      sampledCodesForEndpoint.add(statusCode);
      return true;
    }

    return false;
  }

  /**
   * Gets a reusable Set for response sampling
   */
  private getResponseSamplingSet(endpointKey: string): Set<number> {
    let set = this.responseSamplingSets.get(endpointKey);
    if (!set) {
      set = new Set();
      this.responseSamplingSets.set(endpointKey, set);
    }
    return set;
  }

  /**
   * Gets a cached endpoint key to avoid string concatenation
   */
  private getEndpointKey(method: string, url: string): string {
    return `${method} ${url}`;
  }

  /**
   * Clears all sampling data
   */
  clear(): void {
    this.responseSamplingSets.clear();
  }

  /**
   * Gets the number of endpoints being tracked
   */
  getEndpointCount(): number {
    return this.responseSamplingSets.size;
  }

  /**
   * Gets the number of sampled status codes for a specific endpoint
   */
  getSampledStatusCodeCount(method: string, url: string): number {
    const endpointKey = this.getEndpointKey(method, url);
    const set = this.responseSamplingSets.get(endpointKey);
    return set ? set.size : 0;
  }

  /**
   * Gets the maximum samples per endpoint configuration
   */
  getMaxSamplesPerEndpoint(): number {
    return this.maxSamplesPerEndpoint;
  }

  /**
   * Checks if the maximum samples limit has been reached for an endpoint
   */
  isMaxSamplesReached(method: string, url: string): boolean {
    const count = this.getSampledStatusCodeCount(method, url);
    return count >= this.maxSamplesPerEndpoint;
  }
}
