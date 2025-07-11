const PERCENTILES = [0.5, 0.75, 0.9, 0.95, 0.99, 0.999, 1];

export class Distribution {
  private buffer: number[] = [];
  private isSorted = false;

  public add(latency: number): void {
    this.buffer.push(latency);
    this.isSorted = false;
  }

  public getTotalCount(): number {
    return this.buffer.length;
  }

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
