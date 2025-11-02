import { Histogram } from 'hdr-histogram-js';

import type { RequestResult } from '../../types';
import { EndpointCollector } from '../collectors/endpoint-collector';
import { LatencyCollector } from '../collectors/latency-collector';
import { StatusCodeCollector } from '../collectors/status-code-collector';
import { Distribution } from '../distribution';

/**
 * Aggregates request results and coordinates statistics collection.
 * This class serves as the main entry point for recording and accessing
 * all load test statistics.
 */
export class ResultAggregator {
  private latencyCollector: LatencyCollector;
  private statusCodeCollector: StatusCodeCollector;
  private endpointCollector: EndpointCollector;
  private distribution: Distribution;
  private sampledResults: RequestResult[] = [];
  private maxSampleSize: number = 1000;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;

  /**
   * Creates a new ResultAggregator instance.
   * @param useUI Whether the UI is enabled (affects recent latency collection)
   * @param maxSampleSize Maximum number of results to sample (defaults to 1000)
   */
  constructor(useUI: boolean = true, maxSampleSize: number = 1000) {
    this.latencyCollector = new LatencyCollector(useUI);
    this.statusCodeCollector = new StatusCodeCollector();
    this.endpointCollector = new EndpointCollector();
    this.distribution = new Distribution();
    this.maxSampleSize = maxSampleSize;
  }

  /**
   * Records a new request result, updating all relevant statistics.
   * @param result The RequestResult to record
   */
  recordResult(result: RequestResult): void {
    // Add to sampled results if we haven't reached the limit
    if (this.sampledResults.length < this.maxSampleSize) {
      // Create a shallow copy for sampled results to avoid pool contamination
      this.sampledResults.push({ ...result });
    }

    // Record latency data
    this.latencyCollector.recordLatency(
      result.latencyMs,
      result.method,
      result.url,
    );
    this.distribution.add(result.latencyMs);

    // Record status code
    this.statusCodeCollector.recordStatusCode(result.status);

    // Record endpoint statistics
    this.endpointCollector.recordRequest(
      result.method,
      result.url,
      result.success,
    );

    // Update success/failure counters
    if (result.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  /**
   * Gets a sample of the results collected during the test run.
   * @returns An array of RequestResult objects
   */
  getSampledResults(): RequestResult[] {
    return [...this.sampledResults];
  }

  /**
   * Gets the global histogram containing all latency values.
   * @returns The HDR histogram instance
   */
  getGlobalHistogram(): Histogram {
    return this.latencyCollector.getGlobalHistogram();
  }

  /**
   * Gets the map of histograms for each endpoint.
   * @returns A map where keys are endpoint identifiers and values are HDR histograms
   */
  getEndpointHistograms(): Map<string, Histogram> {
    return this.latencyCollector.getEndpointHistograms();
  }

  /**
   * Gets the latency distribution.
   * @param options Options for generating the distribution
   * @returns An array of distribution buckets
   */
  getLatencyDistribution(options: { count: number; chartWidth?: number }): {
    latency: string;
    count: string;
    percent: string;
    cumulative: string;
    chart: string;
  }[] {
    return this.distribution.getLatencyDistribution(options);
  }

  /**
   * Gets the full Distribution instance.
   * @returns The Distribution instance containing all latency data
   */
  getDistribution(): Distribution {
    return this.distribution;
  }

  /**
   * Gets the map of status codes and their counts.
   * @returns A record where keys are status codes and values are their counts
   */
  getStatusCodeMap(): Record<number, number> {
    return this.statusCodeCollector.getStatusCodeMap();
  }

  /**
   * Gets the status code distribution by category.
   * @returns An object containing the counts for each status code category
   */
  getStatusCodeDistributionByCategory(): {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
    other: number;
  } {
    return this.statusCodeCollector.getStatusCodeDistributionByCategory();
  }

  /**
   * Gets the total count of successful requests.
   * @returns The number of successful requests
   */
  getSuccessfulRequestsCount(): number {
    return this.successfulRequests;
  }

  /**
   * Gets the total count of failed requests.
   * @returns The number of failed requests
   */
  getFailedRequestsCount(): number {
    return this.failedRequests;
  }

  /**
   * Gets the total count of all requests.
   * @returns The total number of requests
   */
  getTotalRequestsCount(): number {
    return this.successfulRequests + this.failedRequests;
  }

  /**
   * Gets the successful requests by endpoint.
   * @returns A map of successful request counts by endpoint
   */
  getSuccessfulRequestsByEndpoint(): Map<string, number> {
    return this.endpointCollector.getSuccessfulRequestsByEndpoint();
  }

  /**
   * Gets the failed requests by endpoint.
   * @returns A map of failed request counts by endpoint
   */
  getFailedRequestsByEndpoint(): Map<string, number> {
    return this.endpointCollector.getFailedRequestsByEndpoint();
  }

  /**
   * Gets an array of recent latency values for the non-UI spinner.
   * @returns An array of latency numbers in milliseconds
   */
  getRecentLatencies(): number[] {
    return this.latencyCollector.getRecentLatencies();
  }

  /**
   * Calculates and returns the average latency for all requests.
   * @returns The average latency in milliseconds
   */
  getAverageLatency(): number {
    return this.latencyCollector.getAverageLatency();
  }

  /**
   * Gets the minimum latency observed.
   * @returns The minimum latency in milliseconds
   */
  getMinLatency(): number {
    return this.latencyCollector.getMinLatency();
  }

  /**
   * Gets the maximum latency observed.
   * @returns The maximum latency in milliseconds
   */
  getMaxLatency(): number {
    return this.latencyCollector.getMaxLatency();
  }

  /**
   * Gets the latency at a specific percentile.
   * @param percentile The percentile (0-100)
   * @returns The latency at the specified percentile in milliseconds
   */
  getLatencyAtPercentile(percentile: number): number {
    return this.latencyCollector.getLatencyAtPercentile(percentile);
  }

  /**
   * Gets the latency collectors for direct access.
   * @returns The latency collector instance
   */
  getLatencyCollector(): LatencyCollector {
    return this.latencyCollector;
  }

  /**
   * Gets the status code collector for direct access.
   * @returns The status code collector instance
   */
  getStatusCodeCollector(): StatusCodeCollector {
    return this.statusCodeCollector;
  }

  /**
   * Gets the endpoint collector for direct access.
   * @returns The endpoint collector instance
   */
  getEndpointCollector(): EndpointCollector {
    return this.endpointCollector;
  }

  /**
   * Checks if early exit conditions are met based on configured thresholds.
   * @param options Configuration options for early exit conditions
   * @returns true if early exit conditions are met, false otherwise
   */
  shouldEarlyExit(options: {
    earlyExitOnError?: boolean;
    errorRateThreshold?: number;
    errorCountThreshold?: number;
    errorStatusCodes?: number[];
  }): boolean {
    if (!options.earlyExitOnError) {
      return false;
    }

    const totalRequests = this.getTotalRequestsCount();
    if (totalRequests === 0) {
      return false;
    }

    // Check error rate threshold
    if (options.errorRateThreshold !== undefined) {
      const errorRate = this.failedRequests / totalRequests;
      if (errorRate >= options.errorRateThreshold) {
        return true;
      }
    }

    // Check error count threshold
    if (options.errorCountThreshold !== undefined) {
      if (this.failedRequests >= options.errorCountThreshold) {
        return true;
      }
    }

    // Check specific status codes threshold
    if (options.errorStatusCodes !== undefined) {
      if (this.statusCodeCollector.hasAnyStatusCode(options.errorStatusCodes)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clears all collected data.
   */
  clear(): void {
    this.sampledResults = [];
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.latencyCollector.clear();
    this.statusCodeCollector.clear();
    this.endpointCollector.clear();
    // Note: Distribution doesn't have a clear method
  }
}
