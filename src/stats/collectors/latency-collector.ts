import { build, Histogram } from 'hdr-histogram-js';

import { CircularBuffer } from '../../utils/circular-buffer';

/**
 * Collects and manages latency statistics for load test requests.
 * This class handles the collection of latency data from individual requests
 * and provides methods to access aggregated latency statistics.
 */
export class LatencyCollector {
  private globalHistogram: Histogram;
  private endpointHistograms: Map<string, Histogram> = new Map();
  private recentLatencies: CircularBuffer<number>;
  private useUI: boolean;

  /**
   * Creates a new LatencyCollector instance.
   * @param useUI Whether the UI is enabled (affects recent latency collection)
   * @param bufferSize Size of the circular buffer for recent latencies
   */
  constructor(useUI: boolean = true, bufferSize: number = 1000) {
    this.globalHistogram = build();
    this.useUI = useUI;
    this.recentLatencies = new CircularBuffer<number>(bufferSize);
  }

  /**
   * Records a latency measurement for a request.
   * @param latencyMs The latency in milliseconds
   * @param method The HTTP method (optional, for endpoint-specific tracking)
   * @param url The request URL (optional, for endpoint-specific tracking)
   */
  recordLatency(latencyMs: number, method?: string, url?: string): void {
    // Record in global histogram
    this.globalHistogram.recordValue(latencyMs);

    // Record in endpoint-specific histogram if method and URL are provided
    if (method && url) {
      const endpointKey = `${method} ${url}`;
      if (!this.endpointHistograms.has(endpointKey)) {
        this.endpointHistograms.set(endpointKey, build());
      }
      this.endpointHistograms.get(endpointKey)!.recordValue(latencyMs);
    }

    // Keep recent latencies for non-UI spinner
    if (!this.useUI) {
      this.recentLatencies.add(latencyMs);
    }
  }

  /**
   * Gets the global histogram containing all latency values.
   * @returns The HDR histogram instance
   */
  getGlobalHistogram(): Histogram {
    return this.globalHistogram;
  }

  /**
   * Gets the map of histograms for each endpoint.
   * @returns A map where keys are endpoint identifiers and values are HDR histograms
   */
  getEndpointHistograms(): Map<string, Histogram> {
    return this.endpointHistograms;
  }

  /**
   * Gets an array of recent latency values.
   * @returns An array of latency numbers in milliseconds
   */
  getRecentLatencies(): number[] {
    return this.recentLatencies.getAll();
  }

  /**
   * Calculates and returns the average latency for all requests.
   * @returns The average latency in milliseconds
   */
  getAverageLatency(): number {
    return this.globalHistogram.mean;
  }

  /**
   * Gets the minimum latency observed.
   * @returns The minimum latency in milliseconds
   */
  getMinLatency(): number {
    return this.globalHistogram.minNonZeroValue;
  }

  /**
   * Gets the maximum latency observed.
   * @returns The maximum latency in milliseconds
   */
  getMaxLatency(): number {
    return this.globalHistogram.maxValue;
  }

  /**
   * Gets the latency at a specific percentile.
   * @param percentile The percentile (0-100)
   * @returns The latency at the specified percentile in milliseconds
   */
  getLatencyAtPercentile(percentile: number): number {
    return this.globalHistogram.getValueAtPercentile(percentile);
  }

  /**
   * Gets the total count of latency measurements recorded.
   * @returns The total count of measurements
   */
  getTotalCount(): number {
    return this.globalHistogram.totalCount;
  }

  /**
   * Clears all collected latency data.
   */
  clear(): void {
    this.globalHistogram.reset();
    this.endpointHistograms.clear();
    // Note: CircularBuffer doesn't have a clear method, but we could add one if needed
  }
}
