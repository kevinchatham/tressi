// HdrHistogramManager.ts (canonical HDR histogram math)
// Fully self-contained TypeScript implementation intended to match
// the canonical Java HdrHistogram math closely (indexing & reconstruction).

import { IHdrHistogramManager } from '../interfaces';
import { LatencyHistogram } from '../types';

export class HdrHistogramManager implements IHdrHistogramManager {
  private readonly sab: SharedArrayBuffer;
  private readonly histograms: Int32Array;
  private readonly endpointsCount: number;
  private readonly significantFigures: number;
  private readonly lowestTrackableValue: number;
  private readonly highestTrackableValue: number;

  // canonical HDR histogram derived values
  private readonly unitMagnitude: number; // number of trailing zero bits for lowestTrackableValue
  private readonly subBucketHalfCountMagnitude: number; // magnitude for half the sub-bucket count
  private readonly subBucketHalfCount: number; // half of sub-bucket count
  private readonly subBucketCount: number; // total sub-buckets in first bucket
  private readonly subBucketMask: number; // mask for sub-bucket index
  private readonly bucketCount: number; // number of buckets required to cover range
  private readonly valuesPerHistogram: number; // length of counts array per histogram

  constructor(
    endpointsCount: number,
    significantFigures: number = 3,
    lowestTrackableValue: number = 1,
    highestTrackableValue: number = 120_000_000,
    externalBuffer?: SharedArrayBuffer,
  ) {
    this.endpointsCount = endpointsCount;
    this.significantFigures = significantFigures;
    this.lowestTrackableValue = Math.max(1, Math.floor(lowestTrackableValue));
    this.highestTrackableValue = Math.max(
      this.lowestTrackableValue,
      Math.floor(highestTrackableValue),
    );

    // unit magnitude: floor(log2(lowestTrackableValue))
    this.unitMagnitude = Math.floor(Math.log2(this.lowestTrackableValue));

    // subBucketHalfCountMagnitude: ceil(log2(10^sigfigs))
    // This approximates the Java implementation which computes the size
    // needed to achieve the requested significant figures.
    const neededDigits = Math.pow(10, this.significantFigures);
    this.subBucketHalfCountMagnitude = Math.ceil(Math.log2(neededDigits));

    this.subBucketHalfCount = 1 << this.subBucketHalfCountMagnitude;
    this.subBucketCount = this.subBucketHalfCount * 2; // full sub-buckets in first bucket
    this.subBucketMask = this.subBucketCount - 1;

    // Determine how many buckets are needed to cover highestTrackableValue
    // We'll find the smallest bucketCount such that highestTrackableValue <=
    // (subBucketCount << (bucketCount + unitMagnitude - 1))
    let bucketsNeeded = 1;
    // value that the highest value representable by the current buckets covers
    let largestValueWithCurrentBuckets =
      this.subBucketCount << this.unitMagnitude; // bucket 0 max (exclusive)

    // Double until we exceed highestTrackableValue
    while (largestValueWithCurrentBuckets <= this.highestTrackableValue) {
      largestValueWithCurrentBuckets <<= 1; // shift to next bucket range
      bucketsNeeded++;
      // safety: avoid infinite loop
      if (bucketsNeeded > 1024) break;
    }

    this.bucketCount = bucketsNeeded;

    // valuesPerHistogram: (bucketCount + 1) * subBucketHalfCount + 1 for overflow
    // This aligns with the canonical indexing scheme where indices are derived
    // as (bucketIndex + 1) * subBucketHalfCount + (subBucketIndex - subBucketHalfCount)
    this.valuesPerHistogram =
      (this.bucketCount + 1) * this.subBucketHalfCount + 1;

    const sabSize = endpointsCount * this.valuesPerHistogram * 4; // Int32

    if (externalBuffer) {
      if (externalBuffer.byteLength < sabSize) {
        throw new Error(
          `Buffer too small: expected ${sabSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this.sab = externalBuffer;
    } else {
      this.sab = new SharedArrayBuffer(sabSize);
    }

    this.histograms = new Int32Array(this.sab);

    if (!externalBuffer) {
      this.histograms.fill(0);
    }
  }

  /**
   * Record latency in milliseconds (accepts fractional ms)
   */
  recordLatency(endpointIndex: number, latencyMs: number): void {
    if (endpointIndex < 0 || endpointIndex >= this.endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }
    if (!isFinite(latencyMs) || latencyMs < 0) return;

    const value = Math.max(0, latencyMs * 1000); // microseconds

    const index = this.countsIndex(value);
    const valueIndex = endpointIndex * this.valuesPerHistogram + index;
    Atomics.add(this.histograms, valueIndex, 1);
  }

  getLatencyHistogram(endpointIndex: number): LatencyHistogram {
    if (endpointIndex < 0 || endpointIndex >= this.endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseIndex = endpointIndex * this.valuesPerHistogram;
    const counts = new Int32Array(
      this.sab,
      baseIndex * 4,
      this.valuesPerHistogram,
    );

    let totalCount = 0;
    for (let i = 0; i < counts.length; i++) totalCount += counts[i];

    if (totalCount === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        stdDev: 0,
        percentiles: {},
        totalCount: 0,
      };
    }

    // percentiles to compute
    const targetPercentiles = [50, 75, 90, 95, 99, 99.9];
    const percentiles: Record<number, number> = {};

    let running = 0;
    let nextTargetIdx = 0;
    const sortedTargets = targetPercentiles.slice().sort((a, b) => a - b);
    const targetsCounts = sortedTargets.map((p) =>
      Math.ceil((p / 100) * totalCount),
    );

    for (
      let i = 0;
      i < counts.length && nextTargetIdx < targetsCounts.length;
      i++
    ) {
      running += counts[i];
      while (
        nextTargetIdx < targetsCounts.length &&
        running >= targetsCounts[nextTargetIdx]
      ) {
        percentiles[sortedTargets[nextTargetIdx]] =
          this.getValueFromIndex(i) / 1000; // ms
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
      const v = this.getValueFromIndex(i);
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v * c;
      sumSq += v * v * c;
    }

    const mean = sum / totalCount;
    const variance = sumSq / totalCount - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    return {
      min: min / 1000,
      max: max / 1000,
      mean: mean / 1000,
      stdDev: stdDev / 1000,
      percentiles,
      totalCount,
    };
  }

  getAllEndpointHistograms(): LatencyHistogram[] {
    const out: LatencyHistogram[] = [];
    for (let i = 0; i < this.endpointsCount; i++)
      out.push(this.getLatencyHistogram(i));
    return out;
  }

  // ------------------------- Canonical mapping helpers -------------------------

  /**
   * Compute the counts array index for a given value (microseconds)
   * Implements canonical mapping: index = (bucketIndex + 1) * subBucketHalfCount + (subBucketIndex - subBucketHalfCount)
   */
  private countsIndex(value: number): number {
    if (value <= 0) return 0;
    if (value > this.highestTrackableValue) return this.valuesPerHistogram - 1; // overflow

    // Convert value down to unit magnitude first for shifting convenience
    // But we'll operate in integer space: use floor
    let bucketIndex = this.getBucketIndex(value);
    let subBucketIndex = Math.floor(
      value / (1 << (bucketIndex + this.unitMagnitude)),
    );

    // Ensure subBucketIndex fits into subBucketCount
    if (subBucketIndex >= this.subBucketCount) {
      // This can happen due to boundary rounding; move to next bucket
      bucketIndex++;
      subBucketIndex = Math.floor(
        value / (1 << (bucketIndex + this.unitMagnitude)),
      );
    }

    // canonical index formula
    const index =
      (bucketIndex + 1) * this.subBucketHalfCount +
      (subBucketIndex - this.subBucketHalfCount);
    // clamp
    if (index < 0) return 0;
    if (index >= this.valuesPerHistogram - 1)
      return this.valuesPerHistogram - 2;
    return index;
  }

  /**
   * Reconstruct a value (microseconds) from a counts-array index
   * This uses the inverse of the canonical mapping used in countsIndex
   */
  private getValueFromIndex(index: number): number {
    if (index <= 0) return 0;
    if (index >= this.valuesPerHistogram - 1) return this.highestTrackableValue;

    const bucketIndex = Math.floor(index / this.subBucketHalfCount) - 1;
    const subBucketIndex =
      (index % this.subBucketHalfCount) + this.subBucketHalfCount;

    if (bucketIndex < 0) {
      // first bucket
      return subBucketIndex << this.unitMagnitude;
    }

    return subBucketIndex << (bucketIndex + this.unitMagnitude);
  }

  /**
   * Determine bucket index by repeatedly shifting value down until it fits in first-bucket range
   * This is a robust way to match canonical Java logic without relying on tricky logarithm off-by-one
   */
  private getBucketIndex(value: number): number {
    // Represent value in units of the unit magnitude (i.e. divide by 2^unitMagnitude)
    let v = Math.floor(value) >>> this.unitMagnitude; // integer
    if (v <= this.subBucketMask) return 0;

    let bucketIndex = 0;
    // shift until value fits within subBucketCount
    while (v > this.subBucketMask) {
      v = v >>> 1; // divide by 2
      bucketIndex++;
      // safety
      if (bucketIndex > 1024) break;
    }

    return bucketIndex;
  }

  // ------------------------- metadata getters -------------------------

  getSharedBuffer(): SharedArrayBuffer {
    return this.sab;
  }
}
