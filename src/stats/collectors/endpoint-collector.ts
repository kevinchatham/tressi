/**
 * Collects and manages endpoint-specific statistics for load test requests.
 * This class tracks request counts, success/failure rates, and other metrics
 * for individual endpoints during load testing.
 */
export class EndpointCollector {
  private successfulRequestsByEndpoint: Map<string, number> = new Map();
  private failedRequestsByEndpoint: Map<string, number> = new Map();

  /**
   * Records a successful request for an endpoint.
   * @param method The HTTP method
   * @param url The request URL
   */
  recordSuccessfulRequest(method: string, url: string): void {
    const endpointKey = `${method} ${url}`;
    this.successfulRequestsByEndpoint.set(
      endpointKey,
      (this.successfulRequestsByEndpoint.get(endpointKey) || 0) + 1,
    );
  }

  /**
   * Records a failed request for an endpoint.
   * @param method The HTTP method
   * @param url The request URL
   */
  recordFailedRequest(method: string, url: string): void {
    const endpointKey = `${method} ${url}`;
    this.failedRequestsByEndpoint.set(
      endpointKey,
      (this.failedRequestsByEndpoint.get(endpointKey) || 0) + 1,
    );
  }

  /**
   * Records a request result for an endpoint.
   * @param method The HTTP method
   * @param url The request URL
   * @param success Whether the request was successful
   */
  recordRequest(method: string, url: string, success: boolean): void {
    if (success) {
      this.recordSuccessfulRequest(method, url);
    } else {
      this.recordFailedRequest(method, url);
    }
  }

  /**
   * Gets the map of successful requests by endpoint.
   * @returns A map where keys are endpoint identifiers and values are successful request counts
   */
  getSuccessfulRequestsByEndpoint(): Map<string, number> {
    return new Map(this.successfulRequestsByEndpoint);
  }

  /**
   * Gets the map of failed requests by endpoint.
   * @returns A map where keys are endpoint identifiers and values are failed request counts
   */
  getFailedRequestsByEndpoint(): Map<string, number> {
    return new Map(this.failedRequestsByEndpoint);
  }

  /**
   * Gets the total request count for a specific endpoint.
   * @param method The HTTP method
   * @param url The request URL
   * @returns The total number of requests for the endpoint
   */
  getTotalRequestsForEndpoint(method: string, url: string): number {
    const endpointKey = `${method} ${url}`;
    const successful = this.successfulRequestsByEndpoint.get(endpointKey) || 0;
    const failed = this.failedRequestsByEndpoint.get(endpointKey) || 0;
    return successful + failed;
  }

  /**
   * Gets the success count for a specific endpoint.
   * @param method The HTTP method
   * @param url The request URL
   * @returns The number of successful requests for the endpoint
   */
  getSuccessfulRequestsForEndpoint(method: string, url: string): number {
    const endpointKey = `${method} ${url}`;
    return this.successfulRequestsByEndpoint.get(endpointKey) || 0;
  }

  /**
   * Gets the failure count for a specific endpoint.
   * @param method The HTTP method
   * @param url The request URL
   * @returns The number of failed requests for the endpoint
   */
  getFailedRequestsForEndpoint(method: string, url: string): number {
    const endpointKey = `${method} ${url}`;
    return this.failedRequestsByEndpoint.get(endpointKey) || 0;
  }

  /**
   * Gets the failure rate for a specific endpoint.
   * @param method The HTTP method
   * @param url The request URL
   * @returns The failure rate as a decimal (0.0 to 1.0)
   */
  getFailureRateForEndpoint(method: string, url: string): number {
    const total = this.getTotalRequestsForEndpoint(method, url);
    if (total === 0) return 0;
    const failed = this.getFailedRequestsForEndpoint(method, url);
    return failed / total;
  }

  /**
   * Gets all endpoint keys that have been recorded.
   * @returns An array of endpoint identifiers
   */
  getAllEndpoints(): string[] {
    const allEndpoints = new Set<string>();
    this.successfulRequestsByEndpoint.forEach((_, key) =>
      allEndpoints.add(key),
    );
    this.failedRequestsByEndpoint.forEach((_, key) => allEndpoints.add(key));
    return Array.from(allEndpoints);
  }

  /**
   * Clears all collected endpoint data.
   */
  clear(): void {
    this.successfulRequestsByEndpoint.clear();
    this.failedRequestsByEndpoint.clear();
  }
}
