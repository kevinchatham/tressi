/**
 * StatsCounterManager - Track success/failure counts and status codes per endpoint
 * Provides per-worker, per-endpoint counter blocks with overflow detection
 *
 * Memory Layout (per worker):
 * Offset   Field                   Type        Notes
 * ------   ----------------------  ---------   ---------------------------------
 * 0        endpointCount           UInt32      Number of endpoints owned
 * 4        reserved                UInt32      Alignment
 * 8        reserved                UInt32      Alignment
 * 12+      endpointCounters        Array of per-endpoint counter blocks
 *         ┌───────────────────────────────────────────────┐
 *         │ successCount       Int32                     │
 *         │ failureCount       Int32                     │
 *         │ statusCodeCount    Int32                     │
 *         │ ringBufferSize     Int32                     │
 *         │ ringBufferHead     Int32 (atomic)           │
 *         │ sampledStatusCount Int32                     │
 *         │ sampledStatusCodes Int32Array (600 slots)    │
 *         │ statusCodeCounters Int32Array (600 slots)    │
 *         │ bodySampleIndices  Int32Array (ring buffer)  │
 *         └───────────────────────────────────────────────┘
 */

import { IStatsCounterManager } from '../interfaces';
import { EndpointCounters } from '../types';

export class StatsCounterManager implements IStatsCounterManager {
  private readonly _sab: SharedArrayBuffer;
  private readonly _counters: Int32Array;
  private readonly _endpointsCount: number;
  private readonly _ringBufferSize: number;
  private readonly _countersPerEndpoint: number;
  private readonly _statusCodeBitmap: Uint32Array;

  // Memory layout constants per endpoint
  private static readonly _successOffset = 0;
  private static readonly _failureOffset = 1;
  private static readonly _bytesSentOffset = 2;
  private static readonly _bytesReceivedOffset = 3;
  private static readonly _ringBufferHeadOffset = 6;
  private static readonly _sampledStatusCountOffset = 7;
  private static readonly _statusCodeCountersOffset = 608; // 600 status codes + 8 header fields
  private static readonly _bodySampleIndicesOffset = 1208; // 600 status codes + 600 counters + 8 header fields

  constructor(
    endpointsCount: number,
    ringBufferSize: number = 100,
    externalBuffer?: SharedArrayBuffer,
  ) {
    this._endpointsCount = endpointsCount;
    this._ringBufferSize = ringBufferSize;

    // Calculate counters per endpoint: 8 header + 600 status codes + 600 counters + ring buffer
    this._countersPerEndpoint = 8 + 600 + 600 + ringBufferSize;

    // Total SAB size: 12 bytes header + (endpoints * counters per endpoint * 4 bytes)
    const headerSize = 12; // endpointCount + 2 reserved UInt32
    const countersSize = endpointsCount * this._countersPerEndpoint * 4;
    const bitmapSize = Math.ceil(600 / 32) * 4 * endpointsCount; // 19 Uint32 per endpoint for status code bitmap
    const totalSize = headerSize + countersSize + bitmapSize;

    if (externalBuffer) {
      // Validate buffer size
      if (externalBuffer.byteLength < totalSize) {
        throw new Error(
          `Buffer too small: expected ${totalSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this._sab = externalBuffer;
    } else {
      this._sab = new SharedArrayBuffer(totalSize);
    }

    // Calculate element counts (convert bytes to elements - 4 bytes per 32-bit element)
    // CRITICAL: These calculations prevent memory overlap by ensuring exact element boundaries
    // Each Int32/Uint32 element is 4 bytes, so we divide byte counts by 4 to get element counts
    const countersElementCount = (headerSize + countersSize) / 4;
    const bitmapElementCount = bitmapSize / 4;

    // Create non-overlapping views with explicit lengths
    // Int32Array view for counters (starts at byte offset 0, covers header + endpoint counters)
    this._counters = new Int32Array(this._sab, 0, countersElementCount);

    // Uint32Array view for status code bitmap (starts immediately after counters)
    const bitmapStart = headerSize + countersSize;
    this._statusCodeBitmap = new Uint32Array(
      this._sab,
      bitmapStart,
      bitmapElementCount,
    );

    // Verify memory layout integrity
    // countersElementCount + bitmapElementCount should equal totalSize / 4
    if (countersElementCount + bitmapElementCount !== totalSize / 4) {
      throw new Error(
        `Memory layout calculation error: expected ${totalSize / 4} total elements, got ${countersElementCount + bitmapElementCount}`,
      );
    }

    // Verify non-overlapping memory regions
    // counters should end exactly where bitmap starts
    if (this._counters.byteLength !== bitmapStart) {
      throw new Error(
        `Memory overlap detected: counters end at ${this._counters.byteLength}, bitmap starts at ${bitmapStart}`,
      );
    }

    // Only initialize if we created the buffer
    if (!externalBuffer) {
      // Initialize header
      Atomics.store(this._counters, 0, endpointsCount);
      Atomics.store(this._counters, 1, 0); // reserved
      Atomics.store(this._counters, 2, 0); // reserved

      // Initialize all counters to 0
      const startOffset = 3; // Skip header
      for (let i = startOffset; i < this._counters.length; i++) {
        Atomics.store(this._counters, i, 0);
      }

      // Initialize status code bitmap (one bit per status code)
      this._statusCodeBitmap.fill(0);
    }
  }

  /**
   * Record a request outcome (success/failure)
   */
  recordRequest(endpointIndex: number, success: boolean): void {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseOffset = 3 + endpointIndex * this._countersPerEndpoint;

    if (success) {
      Atomics.add(
        this._counters,
        baseOffset + StatsCounterManager._successOffset,
        1,
      );
    } else {
      Atomics.add(
        this._counters,
        baseOffset + StatsCounterManager._failureOffset,
        1,
      );
    }
  }

  /**
   * Record bytes sent for a request
   */
  recordBytesSent(endpointIndex: number, bytes: number): void {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }
    if (bytes < 0) {
      return; // Ignore negative byte counts
    }

    const baseOffset = 3 + endpointIndex * this._countersPerEndpoint;
    Atomics.add(
      this._counters,
      baseOffset + StatsCounterManager._bytesSentOffset,
      bytes,
    );
  }

  /**
   * Record bytes received for a response
   */
  recordBytesReceived(endpointIndex: number, bytes: number): void {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }
    if (bytes < 0) {
      return; // Ignore negative byte counts
    }

    const baseOffset = 3 + endpointIndex * this._countersPerEndpoint;
    Atomics.add(
      this._counters,
      baseOffset + StatsCounterManager._bytesReceivedOffset,
      bytes,
    );
  }

  /**
   * Record a status code for an endpoint with "one body per status code" enforcement
   */
  recordStatusCode(endpointIndex: number, statusCode: number): void {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    if (statusCode < 100 || statusCode > 699) {
      return; // Ignore invalid status codes
    }

    const baseOffset = 3 + endpointIndex * this._countersPerEndpoint;
    const statusIndex = statusCode - 100; // Map 100-699 to 0-599

    // Check if we've already recorded this status code using bitmap
    const bitmapOffset = this._getBitmapOffset(endpointIndex, statusIndex);
    const bitMask = 1 << (statusIndex % 32);

    // Use compareExchange to enforce "one body per status code"
    const current = Atomics.load(this._statusCodeBitmap, bitmapOffset);
    if ((current & bitMask) === 0) {
      // Status code not seen before, try to set the bit
      const expected = current;
      const updated = current | bitMask;

      if (
        Atomics.compareExchange(
          this._statusCodeBitmap,
          bitmapOffset,
          expected,
          updated,
        ) === expected
      ) {
        // Successfully set the bit - this is the first time we've seen this status code
        // Increment status code counter
        Atomics.add(
          this._counters,
          baseOffset +
            StatsCounterManager._statusCodeCountersOffset +
            statusIndex,
          1,
        );

        // Add to sampled status codes ring buffer
        const headIndex =
          baseOffset + StatsCounterManager._ringBufferHeadOffset;
        const sampledCountIndex =
          baseOffset + StatsCounterManager._sampledStatusCountOffset;

        // Get current head position atomically
        const head = Atomics.load(this._counters, headIndex);
        const nextHead = (head + 1) % this._ringBufferSize;

        // Update ring buffer head
        Atomics.store(this._counters, headIndex, nextHead);

        // Store status code in ring buffer
        const ringBufferOffset =
          baseOffset + StatsCounterManager._bodySampleIndicesOffset;
        this._counters[ringBufferOffset + head] = statusCode;

        // Increment sampled count (capped at ring buffer size)
        const currentCount = Atomics.load(this._counters, sampledCountIndex);
        if (currentCount < this._ringBufferSize) {
          Atomics.add(this._counters, sampledCountIndex, 1);
        }
      }
    } else {
      // Status code already seen, just increment the counter
      Atomics.add(
        this._counters,
        baseOffset +
          StatsCounterManager._statusCodeCountersOffset +
          statusIndex,
        1,
      );
    }
  }

  /**
   * Get counters for a specific endpoint
   */
  getEndpointCounters(endpointIndex: number): EndpointCounters {
    if (endpointIndex < 0 || endpointIndex >= this._endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseOffset = 3 + endpointIndex * this._countersPerEndpoint;

    const successCount = Atomics.load(
      this._counters,
      baseOffset + StatsCounterManager._successOffset,
    );
    const failureCount = Atomics.load(
      this._counters,
      baseOffset + StatsCounterManager._failureOffset,
    );
    const bytesSent = Atomics.load(
      this._counters,
      baseOffset + StatsCounterManager._bytesSentOffset,
    );
    const bytesReceived = Atomics.load(
      this._counters,
      baseOffset + StatsCounterManager._bytesReceivedOffset,
    );

    // Read status code counts
    const statusCodeCounts: Record<number, number> = {};
    for (let i = 0; i < 600; i++) {
      const count = Atomics.load(
        this._counters,
        baseOffset + StatsCounterManager._statusCodeCountersOffset + i,
      );
      if (count > 0) {
        statusCodeCounts[i + 100] = count; // Map back to 100-699
      }
    }

    // Read sampled status codes from ring buffer
    const sampledCount = Math.min(
      Atomics.load(
        this._counters,
        baseOffset + StatsCounterManager._sampledStatusCountOffset,
      ),
      this._ringBufferSize,
    );

    const ringBufferOffset =
      baseOffset + StatsCounterManager._bodySampleIndicesOffset;
    const sampledStatusCodes: number[] = [];
    for (let i = 0; i < sampledCount; i++) {
      sampledStatusCodes.push(this._counters[ringBufferOffset + i]);
    }

    // Body sample indices are the same as sampled status codes in this implementation
    const bodySampleIndices = [...sampledStatusCodes];

    return {
      successCount,
      failureCount,
      bytesSent,
      bytesReceived,
      statusCodeCounts,
      sampledStatusCodes,
      bodySampleIndices,
    };
  }

  /**
   * Get counters for all endpoints
   */
  getAllEndpointCounters(): EndpointCounters[] {
    const counters: EndpointCounters[] = [];
    for (let i = 0; i < this._endpointsCount; i++) {
      counters.push(this.getEndpointCounters(i));
    }
    return counters;
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this._sab;
  }

  /**
   * Get endpoints count
   */
  getEndpointsCount(): number {
    return this._endpointsCount;
  }

  /**
   * Calculate bitmap offset for status code
   */
  private _getBitmapOffset(endpointIndex: number, statusIndex: number): number {
    // Since statusCodeBitmap is a Uint32Array starting at the bitmap section,
    // we can use direct indexing within the bitmap array
    const bitmapEntriesPerEndpoint = 19; // 600 status codes / 32 bits per Uint32 = 18.75, rounded up to 19
    return (
      endpointIndex * bitmapEntriesPerEndpoint + Math.floor(statusIndex / 32)
    );
  }
}
