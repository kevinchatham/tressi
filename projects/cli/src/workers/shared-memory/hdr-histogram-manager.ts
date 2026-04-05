// HdrHistogramManager.ts (canonical HDR histogram math)
// Fully self-contained TypeScript implementation intended to match
// the canonical Java HdrHistogram math closely (indexing & reconstruction).

import type { IHdrHistogramManager } from '@tressi/shared/cli';
import type { LatencyHistogram, LatencyHistogramBucket } from '@tressi/shared/common';

export class HdrHistogramManager implements IHdrHistogramManager {
  private readonly _sab: SharedArrayBuffer;
  private readonly _histograms: Int32Array;
  private readonly _endpointsCount: number;
  private readonly _significantFigures: number;
  private readonly _lowestTrackableValue: number;
  private readonly _highestTrackableValue: number;

  // canonical HDR histogram derived values
  private readonly _unitMagnitude: number; // number of trailing zero bits for lowestTrackableValue
  private readonly _subBucketHalfCountMagnitude: number; // magnitude for half the sub-bucket count
  private readonly _subBucketHalfCount: number; // half of sub-bucket count
  private readonly _subBucketCount: number; // total sub-buckets in first bucket
  private readonly _subBucketMask: number; // mask for sub-bucket index
  private readonly _bucketCount: number; // number of buckets required to cover range
  private readonly _valuesPerHistogram: number; // length of counts array per histogram

  constructor(
    endpointsCount: number,
    significantFigures: number = 3,
    lowestTrackableValue: number = 1,
    highestTrackableValue: number = 120_000_000,
    externalBuffer?: SharedArrayBuffer,
  ) {
    this._endpointsCount = endpointsCount;
    this._significantFigures = significantFigures;
    this._lowestTrackableValue = Math.max(1, Math.floor(lowestTrackableValue));
    this._highestTrackableValue = Math.max(
      this._lowestTrackableValue,
      Math.floor(highestTrackableValue),
    );

    // unit magnitude: floor(log2(lowestTrackableValue))
    this._unitMagnitude = Math.floor(Math.log2(this._lowestTrackableValue));

    // subBucketHalfCountMagnitude: ceil(log2(10^sigfigs))
    // This approximates the Java implementation which computes the size
    // needed to achieve the requested significant figures.
    const neededDigits = 10 ** this._significantFigures;
    this._subBucketHalfCountMagnitude = Math.ceil(Math.log2(neededDigits));

    this._subBucketHalfCount = 1 << this._subBucketHalfCountMagnitude;
    this._subBucketCount = this._subBucketHalfCount * 2; // full sub-buckets in first bucket
    this._subBucketMask = this._subBucketCount - 1;

    // Determine how many buckets are needed to cover highestTrackableValue
    // We'll find the smallest bucketCount such that highestTrackableValue <=
    // (subBucketCount << (bucketCount + unitMagnitude - 1))
    let bucketsNeeded = 1;
    // value that the highest value representable by the current buckets covers
    let largestValueWithCurrentBuckets = this._subBucketCount << this._unitMagnitude; // bucket 0 max (exclusive)

    // Double until we exceed highestTrackableValue
    while (largestValueWithCurrentBuckets <= this._highestTrackableValue) {
      largestValueWithCurrentBuckets <<= 1; // shift to next bucket range
      bucketsNeeded++;
      // safety: avoid infinite loop
      if (bucketsNeeded > 1024) break;
    }

    this._bucketCount = bucketsNeeded;

    // valuesPerHistogram: (bucketCount + 1) * subBucketHalfCount + 1 for overflow
    // This aligns with the canonical indexing scheme where indices are derived
    // as (bucketIndex + 1) * subBucketHalfCount + (subBucketIndex - subBucketHalfCount)
    this._valuesPerHistogram = (this._bucketCount + 1) * this._subBucketHalfCount + 1;

    const sabSize = endpointsCount * this._valuesPerHistogram * 4; // Int32

    if (externalBuffer) {
      if (externalBuffer.byteLength < sabSize) {
        throw new Error(`Buffer too small: expected ${sabSize}, got ${externalBuffer.byteLength}`);
      }
      this._sab = externalBuffer;
    } else {
      this._sab = new SharedArrayBuffer(sabSize);
    }

    this._histograms = new Int32Array(this._sab);

    if (!externalBuffer) {
      this._histograms.fill(0);
    }
  }

  /**
   * Record latency in milliseconds (accepts fractional ms)
   */
  recordLatency(endpointIndex: number, latencyMs: number): void {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;

    const value = Math.max(0, latencyMs * 1000); // microseconds

    const index = this._countsIndex(value);
    const valueIndex = endpointIndex * this._valuesPerHistogram + index;
    Atomics.add(this._histograms, valueIndex, 1);
  }

  getLatencyHistogram(endpointIndex: number): LatencyHistogram {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseIndex = endpointIndex * this._valuesPerHistogram;
    const counts = new Int32Array(this._sab, baseIndex * 4, this._valuesPerHistogram);

    let totalCount = 0;
    for (const count of counts) totalCount += count;

    if (totalCount === 0) {
      return {
        buckets: [],
        max: 0,
        mean: 0,
        min: 0,
        percentiles: {},
        stdDev: 0,
        totalCount: 0,
      };
    }

    // percentiles to compute (expanded to include more granular percentiles)
    const targetPercentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99, 99.9];
    const percentiles: Record<number, number> = {};

    let running = 0;
    let nextTargetIdx = 0;
    const sortedTargets = targetPercentiles.slice().sort((a, b) => a - b);
    const targetsCounts = sortedTargets.map((p) => Math.ceil((p / 100) * totalCount));

    for (let i = 0; i < counts.length && nextTargetIdx < targetsCounts.length; i++) {
      running += counts[i];
      while (nextTargetIdx < targetsCounts.length && running >= targetsCounts[nextTargetIdx]) {
        percentiles[sortedTargets[nextTargetIdx]] = this._getValueFromIndex(i) / 1000; // ms
        nextTargetIdx++;
      }
    }

    // compute min, max, mean, stddev
    let min = Infinity;
    let max = 0;
    let sum = 0;
    let sumSq = 0;

    for (let i = 0; i < counts.length; i++) {
      const c = counts[i];
      if (c === 0) continue;
      const v = this._getValueFromIndex(i);
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v * c;
      sumSq += v * v * c;
    }

    const mean = sum / totalCount;
    const variance = sumSq / totalCount - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Extract bucket data with intelligent grouping (max 15 buckets)
    const buckets = this._extractBuckets(counts);

    return {
      buckets,
      max: max / 1000,
      mean: mean / 1000,
      min: min / 1000,
      percentiles,
      stdDev: stdDev / 1000,
      totalCount,
    };
  }

  /**
   * Extract bucket data from histogram counts, merging to max 15 buckets
   */
  private _extractBuckets(counts: Int32Array): Array<LatencyHistogramBucket> {
    const rawBuckets = this._collectRawBuckets(counts);
    if (rawBuckets.length === 0) return [];

    const sortedBuckets = rawBuckets.toSorted(
      (a: LatencyHistogramBucket, b: LatencyHistogramBucket) => a.lowerBound - b.lowerBound,
    );
    const uniqueBuckets = this._mergeOverlappingBuckets(sortedBuckets);
    const mergedBuckets = this._mergeSameFormattedBuckets(uniqueBuckets);
    return this._mergeToMaxBuckets(mergedBuckets, 10);
  }

  private _collectRawBuckets(counts: Int32Array): Array<LatencyHistogramBucket> {
    const rawBuckets: Array<LatencyHistogramBucket> = [];
    for (let i = 0; i < counts.length; i++) {
      const count = counts[i];
      if (count > 0) {
        const lowerBound = this._getValueFromIndex(i) / 1000;
        const upperBound = this._getValueFromIndex(i + 1) / 1000;
        rawBuckets.push({ count, lowerBound, upperBound });
      }
    }
    return rawBuckets;
  }

  private _mergeOverlappingBuckets(
    buckets: Array<LatencyHistogramBucket>,
  ): Array<LatencyHistogramBucket> {
    const uniqueBuckets: Array<LatencyHistogramBucket> = [];
    for (const rb of buckets) {
      if (uniqueBuckets.length > 0) {
        const last = uniqueBuckets.at(-1)!;
        if (rb.lowerBound < last.upperBound) {
          last.count += rb.count;
          last.upperBound = Math.max(last.upperBound, rb.upperBound);
          continue;
        }
      }
      uniqueBuckets.push({ ...rb });
    }
    return uniqueBuckets;
  }

  private _formatBucketLabel(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private _mergeSameFormattedBuckets(
    buckets: Array<LatencyHistogramBucket>,
  ): Array<LatencyHistogramBucket> {
    const mergedBuckets: Array<LatencyHistogramBucket> = [];
    for (const ub of buckets) {
      if (mergedBuckets.length > 0) {
        const last = mergedBuckets.at(-1)!;
        if (
          this._formatBucketLabel(last.lowerBound) === this._formatBucketLabel(ub.lowerBound) ||
          this._formatBucketLabel(last.upperBound) === this._formatBucketLabel(ub.upperBound)
        ) {
          last.count += ub.count;
          last.upperBound = ub.upperBound;
          continue;
        }
      }
      mergedBuckets.push({ ...ub });
    }
    return mergedBuckets;
  }

  private _mergeToMaxBuckets(
    buckets: Array<LatencyHistogramBucket>,
    maxBuckets: number,
  ): Array<LatencyHistogramBucket> {
    if (buckets.length <= maxBuckets) return buckets;

    const result: Array<LatencyHistogramBucket> = [];
    const mergeFactor = Math.ceil(buckets.length / maxBuckets);

    for (let i = 0; i < buckets.length; i += mergeFactor) {
      const group = buckets.slice(i, i + mergeFactor);
      if (group.length === 0) continue;

      const groupCount = group.reduce((sum, b) => sum + b.count, 0);
      result.push({
        count: groupCount,
        lowerBound: group[0].lowerBound,
        upperBound: group.at(-1)!.upperBound,
      });
    }
    return result;
  }

  getAllEndpointHistograms(): LatencyHistogram[] {
    const out: LatencyHistogram[] = [];
    for (let i = 0; i < this._endpointsCount; i++) out.push(this.getLatencyHistogram(i));
    return out;
  }

  // ------------------------- Canonical mapping helpers -------------------------

  /**
   * Compute the counts array index for a given value (microseconds)
   * Implements canonical mapping: index = (bucketIndex + 1) * subBucketHalfCount + (subBucketIndex - subBucketHalfCount)
   */
  private _countsIndex(value: number): number {
    if (value <= 0) return 0;
    if (value > this._highestTrackableValue) return this._valuesPerHistogram - 1; // overflow

    // Convert value down to unit magnitude first for shifting convenience
    // But we'll operate in integer space: use floor
    let bucketIndex = this._getBucketIndex(value);
    let subBucketIndex = Math.floor(value / (1 << (bucketIndex + this._unitMagnitude)));

    // Ensure subBucketIndex fits into subBucketCount
    if (subBucketIndex >= this._subBucketCount) {
      // This can happen due to boundary rounding; move to next bucket
      bucketIndex++;
      subBucketIndex = Math.floor(value / (1 << (bucketIndex + this._unitMagnitude)));
    }

    // canonical index formula
    const index =
      (bucketIndex + 1) * this._subBucketHalfCount + (subBucketIndex - this._subBucketHalfCount);
    // clamp
    if (index < 0) return 0;
    if (index >= this._valuesPerHistogram - 1) return this._valuesPerHistogram - 2;
    return index;
  }

  /**
   * Reconstruct a value (microseconds) from a counts-array index
   * This uses the inverse of the canonical mapping used in countsIndex
   */
  private _getValueFromIndex(index: number): number {
    if (index <= 0) return 0;
    if (index >= this._valuesPerHistogram - 1) return this._highestTrackableValue;

    let bucketIndex = Math.floor(index / this._subBucketHalfCount) - 1;
    let subBucketIndex = (index % this._subBucketHalfCount) + this._subBucketHalfCount;

    if (bucketIndex < 0) {
      // first bucket (bucketIndex 0)
      subBucketIndex -= this._subBucketHalfCount;
      bucketIndex = 0;
    }

    return subBucketIndex << (bucketIndex + this._unitMagnitude);
  }

  /**
   * Determine bucket index by repeatedly shifting value down until it fits in first-bucket range
   * This is a robust way to match canonical Java logic without relying on tricky logarithm off-by-one
   */
  private _getBucketIndex(value: number): number {
    // Represent value in units of the unit magnitude (i.e. divide by 2^unitMagnitude)
    let v = Math.floor(value) >>> this._unitMagnitude; // integer
    if (v <= this._subBucketMask) return 0;

    let bucketIndex = 0;
    // shift until value fits within subBucketCount
    while (v > this._subBucketMask) {
      v = v >>> 1; // divide by 2
      bucketIndex++;
      // safety
      if (bucketIndex > 1024) break;
    }

    return bucketIndex;
  }

  // ------------------------- metadata getters -------------------------

  getSharedBuffer(): SharedArrayBuffer {
    return this._sab;
  }
}
