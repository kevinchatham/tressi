import { Histogram } from 'hdr-histogram-js';

/**
 * Calculates latency statistics from histogram data.
 * This class provides methods to compute various latency metrics from HDR histograms.
 */
export class LatencyCalculator {
  /**
   * Calculates the average latency from a histogram.
   * @param histogram The HDR histogram containing latency data
   * @returns The average latency in milliseconds
   */
  static calculateAverageLatency(histogram: Histogram): number {
    return histogram.mean;
  }

  /**
   * Calculates the minimum latency from a histogram.
   * @param histogram The HDR histogram containing latency data
   * @returns The minimum latency in milliseconds
   */
  static calculateMinLatency(histogram: Histogram): number {
    return histogram.minNonZeroValue;
  }

  /**
   * Calculates the maximum latency from a histogram.
   * @param histogram The HDR histogram containing latency data
   * @returns The maximum latency in milliseconds
   */
  static calculateMaxLatency(histogram: Histogram): number {
    return histogram.maxValue;
  }

  /**
   * Calculates the latency at a specific percentile.
   * @param histogram The HDR histogram containing latency data
   * @param percentile The percentile (0-100)
   * @returns The latency at the specified percentile in milliseconds
   */
  static calculateLatencyAtPercentile(
    histogram: Histogram,
    percentile: number,
  ): number {
    return histogram.getValueAtPercentile(percentile);
  }

  /**
   * Calculates multiple percentile latencies at once.
   * @param histogram The HDR histogram containing latency data
   * @param percentiles Array of percentiles to calculate (0-100)
   * @returns An object mapping percentile names to latency values
   */
  static calculatePercentiles(
    histogram: Histogram,
    percentiles: number[],
  ): Record<string, number> {
    const result: Record<string, number> = {};

    for (const percentile of percentiles) {
      const key = `p${percentile}`;
      result[key] = histogram.getValueAtPercentile(percentile);
    }

    return result;
  }

  /**
   * Calculates common percentile latencies (p50, p95, p99).
   * @param histogram The HDR histogram containing latency data
   * @returns An object containing p50, p95, and p99 latencies
   */
  static calculateCommonPercentiles(histogram: Histogram): {
    p50: number;
    p95: number;
    p99: number;
  } {
    return {
      p50: histogram.getValueAtPercentile(50),
      p95: histogram.getValueAtPercentile(95),
      p99: histogram.getValueAtPercentile(99),
    };
  }

  /**
   * Calculates the standard deviation of latencies.
   * @param histogram The HDR histogram containing latency data
   * @returns The standard deviation in milliseconds
   */
  static calculateStandardDeviation(histogram: Histogram): number {
    return histogram.stdDeviation;
  }

  /**
   * Calculates latency statistics summary.
   * @param histogram The HDR histogram containing latency data
   * @returns An object containing comprehensive latency statistics
   */
  static calculateLatencySummary(histogram: Histogram): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    stdDev: number;
    totalCount: number;
  } {
    return {
      avg: histogram.mean,
      min: histogram.minNonZeroValue,
      max: histogram.maxValue,
      p50: histogram.getValueAtPercentile(50),
      p95: histogram.getValueAtPercentile(95),
      p99: histogram.getValueAtPercentile(99),
      stdDev: histogram.stdDeviation,
      totalCount: histogram.totalCount,
    };
  }

  /**
   * Calculates the theoretical maximum RPS based on average latency and worker count.
   * @param avgLatencyMs The average latency in milliseconds
   * @param workerCount The number of workers
   * @param targetRps The target RPS (optional, used to cap the theoretical max)
   * @returns The theoretical maximum RPS
   */
  static calculateTheoreticalMaxRps(
    avgLatencyMs: number,
    workerCount: number,
    targetRps?: number,
  ): number {
    if (avgLatencyMs <= 0) return 0;

    const theoreticalMax = (1000 / avgLatencyMs) * workerCount;

    return targetRps ? Math.min(theoreticalMax, targetRps) : theoreticalMax;
  }

  /**
   * Calculates the percentage of theoretical maximum RPS achieved.
   * @param actualRps The actual RPS achieved
   * @param theoreticalMaxRps The theoretical maximum RPS
   * @returns The percentage achieved (0-100)
   */
  static calculateAchievedPercentage(
    actualRps: number,
    theoreticalMaxRps: number,
  ): number {
    if (theoreticalMaxRps <= 0) return 0;
    return (actualRps / theoreticalMaxRps) * 100;
  }

  /**
   * Validates if a histogram has sufficient data for reliable statistics.
   * @param histogram The HDR histogram to validate
   * @param minCount Minimum number of samples required (defaults to 10)
   * @returns true if the histogram has sufficient data
   */
  static hasSufficientData(
    histogram: Histogram,
    minCount: number = 10,
  ): boolean {
    return histogram.totalCount >= minCount;
  }
}
