const PERCENTILES = [0.5, 0.75, 0.9, 0.95, 0.99, 0.999, 1];

/**
 * A class for calculating and storing latency distribution data.
 * It is used to generate histogram-style views of latency values.
 */
export class Distribution {
  private buffer: number[] = [];
  private isSorted = false;

  /**
   * Adds a new latency measurement to the distribution.
   * @param latency The latency value in milliseconds.
   */
  public add(latency: number): void {
    this.buffer.push(latency);
    this.isSorted = false;
  }

  /**
   * Gets the total number of latency measurements recorded.
   * @returns The total count of items.
   */
  public getTotalCount(): number {
    return this.buffer.length;
  }

  /**
   * Calculates the latency at various predefined percentiles.
   * @returns An array of objects, each containing a percentile and the corresponding latency.
   */
  public getPercentiles(): { percentile: number; latency: number }[] {
    if (!this.isSorted) {
      this.buffer.sort((a, b) => a - b);
      this.isSorted = true;
    }

    return PERCENTILES.map((percentile) => {
      const index = Math.floor(this.buffer.length * percentile) - 1;
      return {
        percentile,
        latency: this.buffer[Math.max(0, index)],
      };
    });
  }

  /**
   * Generates a latency distribution report with a specified number of buckets.
   * This is used to create tables and charts for the UI and reports.
   * @param options - The options for generating the distribution.
   * @param options.count - The number of buckets to group latencies into.
   * @param options.chartWidth - The maximum width of the chart bar.
   * @returns An array of objects representing each bucket in the distribution.
   */
  public getLatencyDistribution(options: {
    count: number;
    chartWidth?: number;
  }): {
    latency: string;
    count: string;
    percent: string;
    cumulative: string;
    chart: string;
  }[] {
    if (this.buffer.length === 0) {
      return [];
    }

    if (!this.isSorted) {
      this.buffer.sort((a, b) => a - b);
      this.isSorted = true;
    }

    const min = this.buffer[0];
    const max = this.buffer[this.buffer.length - 1];
    const range = max - min;
    const bucketSize = Math.ceil(range / options.count) || 1;

    const buckets = Array.from({ length: options.count }, (_, i) => {
      const bucketMin = min + i * bucketSize;
      const bucketMax = bucketMin + bucketSize - 1;
      return {
        min: bucketMin,
        max: bucketMax,
        count: 0,
      };
    });

    for (const latency of this.buffer) {
      // Find the correct bucket
      let bucketIndex = Math.floor((latency - min) / bucketSize);
      bucketIndex = Math.min(bucketIndex, options.count - 1); // Clamp to last bucket
      if (buckets[bucketIndex]) {
        buckets[bucketIndex].count++;
      }
    }

    let cumulativeCount = 0;
    const totalCount = this.buffer.length;
    const maxCountInBucket = Math.max(...buckets.map((b) => b.count));
    const chartWidth = options.chartWidth || 20;

    return buckets.map((bucket, i) => {
      cumulativeCount += bucket.count;
      const percent = ((bucket.count / totalCount) * 100).toFixed(0);
      const cumulativePercent = ((cumulativeCount / totalCount) * 100).toFixed(
        0,
      );
      const chartBar =
        maxCountInBucket > 0
          ? '█'.repeat(
              Math.round((bucket.count / maxCountInBucket) * chartWidth),
            )
          : '';

      const rangeLabel =
        i === options.count - 1
          ? `${Math.round(bucket.min)}+`
          : `${Math.round(bucket.min)}-${Math.round(bucket.max)}`;

      return {
        latency: rangeLabel,
        count: bucket.count.toString(),
        percent: `${percent}%`,
        cumulative: `${cumulativePercent}%`,
        chart: chartBar,
      };
    });
  }
}
