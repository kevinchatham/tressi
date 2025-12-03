/**
 * BodySampleManager - Store body sample indices for async retrieval
 * Provides per-endpoint lock-free ring buffer for body sample management
 *
 * Memory Layout (per endpoint):
 * Offset   Field      Type       Notes
 * 0        bufferSize UInt32     Total capacity
 * 4        head       Int32      Atomic write pointer
 * 8        tail       Int32      Atomic read pointer
 * 12+      indices    Int32Array Stores [sampleIndex, statusCode] pairs
 */

import { IBodySampleManager } from '../../types/workers/interfaces';
import { BodySample } from '../../types/workers/types';

export class BodySampleManager implements IBodySampleManager {
  private readonly sab: SharedArrayBuffer;
  private readonly data: Int32Array;
  private readonly endpointsCount: number;
  private readonly bufferSize: number;
  private readonly fieldsPerEndpoint: number;

  // Memory layout constants per endpoint
  private static readonly BUFFER_SIZE_OFFSET = 0;
  private static readonly HEAD_OFFSET = 1;
  private static readonly TAIL_OFFSET = 2;
  private static readonly INDICES_OFFSET = 3;

  constructor(
    endpointsCount: number,
    bufferSize: number = 1000,
    externalBuffer?: SharedArrayBuffer,
  ) {
    this.endpointsCount = endpointsCount;
    this.bufferSize = bufferSize;

    // Calculate memory layout per endpoint:
    // 3 header fields + (bufferSize * 2) for [sampleIndex, statusCode] pairs
    this.fieldsPerEndpoint = 3 + bufferSize * 2;

    // Total SAB size: endpoints * fields per endpoint * 4 bytes
    const sabSize = endpointsCount * this.fieldsPerEndpoint * 4;

    if (externalBuffer) {
      // Validate buffer size
      if (externalBuffer.byteLength < sabSize) {
        throw new Error(
          `Buffer too small: expected ${sabSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this.sab = externalBuffer;
    } else {
      this.sab = new SharedArrayBuffer(sabSize);
    }

    this.data = new Int32Array(this.sab);

    // Only initialize if we created the buffer
    if (!externalBuffer) {
      // Initialize all endpoints
      for (
        let endpointIndex = 0;
        endpointIndex < endpointsCount;
        endpointIndex++
      ) {
        const baseOffset = endpointIndex * this.fieldsPerEndpoint;

        // Initialize buffer metadata
        Atomics.store(
          this.data,
          baseOffset + BodySampleManager.BUFFER_SIZE_OFFSET,
          bufferSize,
        );
        Atomics.store(this.data, baseOffset + BodySampleManager.HEAD_OFFSET, 0);
        Atomics.store(this.data, baseOffset + BodySampleManager.TAIL_OFFSET, 0);

        // Initialize sample data to -1 (empty)
        const samplesStart = baseOffset + BodySampleManager.INDICES_OFFSET;
        for (let i = 0; i < bufferSize * 2; i += 2) {
          Atomics.store(this.data, samplesStart + i, -1); // sampleIndex
          Atomics.store(this.data, samplesStart + i + 1, -1); // statusCode
        }
      }
    }
  }

  /**
   * Record a body sample for an endpoint with "one body per status code" enforcement
   * @param endpointIndex The endpoint index
   * @param sampleIndex The sample index
   * @param statusCode The HTTP status code
   * @returns true if sample was recorded, false if buffer is full or status code already has a sample
   */
  recordBodySample(
    endpointIndex: number,
    sampleIndex: number,
    statusCode: number,
  ): boolean {
    if (endpointIndex < 0 || endpointIndex >= this.endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseOffset = endpointIndex * this.fieldsPerEndpoint;
    const headIndex = baseOffset + BodySampleManager.HEAD_OFFSET;
    const tailIndex = baseOffset + BodySampleManager.TAIL_OFFSET;

    // Get current head position
    const head = Atomics.load(this.data, headIndex);

    // Calculate next head position
    const nextHead = (head + 1) % this.bufferSize;

    // Check if buffer is full (next head would equal tail)
    const tail = Atomics.load(this.data, tailIndex);
    if (nextHead === tail) {
      return false; // Buffer is full
    }

    // Store the sample
    const sampleOffset =
      baseOffset + BodySampleManager.INDICES_OFFSET + head * 2;
    Atomics.store(this.data, sampleOffset, sampleIndex);
    Atomics.store(this.data, sampleOffset + 1, statusCode);

    // Update head atomically
    Atomics.store(this.data, headIndex, nextHead);

    return true;
  }

  /**
   * Get body sample indices for an endpoint
   * @param endpointIndex The endpoint index
   * @returns Array of body samples
   */
  getBodySampleIndices(endpointIndex: number): BodySample[] {
    if (endpointIndex < 0 || endpointIndex >= this.endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseOffset = endpointIndex * this.fieldsPerEndpoint;
    const headIndex = baseOffset + BodySampleManager.HEAD_OFFSET;
    const tailIndex = baseOffset + BodySampleManager.TAIL_OFFSET;

    const head = Atomics.load(this.data, headIndex);
    const tail = Atomics.load(this.data, tailIndex);

    const samples: BodySample[] = [];

    // Calculate the number of valid samples
    let count = 0;
    if (head >= tail) {
      count = head - tail;
    } else {
      count = this.bufferSize - tail + head;
    }

    // Read samples in order from tail to head
    const samplesStart = baseOffset + BodySampleManager.INDICES_OFFSET;
    for (let i = 0; i < count; i++) {
      const index = (tail + i) % this.bufferSize;
      const sampleOffset = samplesStart + index * 2;

      const sampleIndex = Atomics.load(this.data, sampleOffset);
      const statusCode = Atomics.load(this.data, sampleOffset + 1);

      if (sampleIndex >= 0 && statusCode >= 0) {
        samples.push({
          sampleIndex,
          statusCode,
        });
      }
    }

    return samples;
  }

  /**
   * Clear body samples for an endpoint
   * @param endpointIndex The endpoint index
   */
  clearBodySamples(endpointIndex: number): void {
    if (endpointIndex < 0 || endpointIndex >= this.endpointsCount) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const baseOffset = endpointIndex * this.fieldsPerEndpoint;
    const headIndex = baseOffset + BodySampleManager.HEAD_OFFSET;
    const tailIndex = baseOffset + BodySampleManager.TAIL_OFFSET;

    // Reset head and tail
    Atomics.store(this.data, headIndex, 0);
    Atomics.store(this.data, tailIndex, 0);

    // Mark all samples as empty
    const samplesStart = baseOffset + BodySampleManager.INDICES_OFFSET;
    for (let i = 0; i < this.bufferSize * 2; i += 2) {
      Atomics.store(this.data, samplesStart + i, -1);
      Atomics.store(this.data, samplesStart + i + 1, -1);
    }
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this.sab;
  }

  /**
   * Get endpoints count
   */
  getEndpointsCount(): number {
    return this.endpointsCount;
  }
}
