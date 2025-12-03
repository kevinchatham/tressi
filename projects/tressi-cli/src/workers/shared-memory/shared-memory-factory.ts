/**
 * SharedMemoryFactory - Factory for creating and managing shared memory managers
 * Provides static method to create all required managers for the new architecture
 */

import type { SafeTressiRequestConfig } from 'tressi-common/config';

import { SharedMemoryOptions } from '../../types/workers/types';
import { BodySampleManager } from './body-sample-manager';
import { EndpointStateManager } from './endpoint-state-manager';
import { HdrHistogramManager } from './hdr-histogram-manager';
import { StatsCounterManager } from './stats-counter-manager';
import { WorkerStateManager } from './worker-state-manager';

export class SharedMemoryFactory {
  /**
   * Create all shared memory managers for the new architecture
   * @param workersCount Number of workers
   * @param endpoints Array of all endpoint configurations
   * @param options Optional configuration
   * @returns Object containing arrays of managers
   */
  static createManagers(
    workersCount: number,
    endpoints: SafeTressiRequestConfig[],
    options?: SharedMemoryOptions,
  ): {
    hdrHistogram: HdrHistogramManager[]; // Array per worker
    workerState: WorkerStateManager;
    statsCounter: StatsCounterManager[]; // Array per worker
    bodySample: BodySampleManager[]; // Array per endpoint
    endpointState: EndpointStateManager;
  } {
    const {
      significantFigures = 3,
      lowestTrackableValue = 1,
      highestTrackableValue = 120_000_000, // 120 seconds in microseconds
      ringBufferSize = 100,
      bodySampleBufferSize = 1000,
    } = options || {};

    // Create single worker state manager (shared across all workers)
    const workerState = new WorkerStateManager(workersCount);

    // Create endpoint state manager (shared across all workers)
    const endpointState = new EndpointStateManager(endpoints.length);

    // Create per-worker managers
    const hdrHistogram: HdrHistogramManager[] = [];
    const statsCounter: StatsCounterManager[] = [];

    // Distribute endpoints to workers
    const workerEndpoints = this.distributeEndpoints(workersCount, endpoints);

    // Create per-worker managers with their assigned endpoint count
    for (let workerId = 0; workerId < workersCount; workerId++) {
      const assignedEndpoints = workerEndpoints[workerId].length;

      hdrHistogram[workerId] = new HdrHistogramManager(
        assignedEndpoints,
        significantFigures,
        lowestTrackableValue,
        highestTrackableValue,
      );

      statsCounter[workerId] = new StatsCounterManager(
        assignedEndpoints,
        ringBufferSize,
      );
    }

    // Create per-endpoint body sample managers
    const bodySample: BodySampleManager[] = [];
    for (
      let endpointIndex = 0;
      endpointIndex < endpoints.length;
      endpointIndex++
    ) {
      bodySample[endpointIndex] = new BodySampleManager(
        1, // One endpoint per manager
        bodySampleBufferSize,
      );
    }

    return {
      hdrHistogram,
      workerState,
      statsCounter,
      bodySample,
      endpointState,
    };
  }

  /**
   * Distribute endpoints to workers using round-robin
   * @param workersCount Number of workers
   * @param endpoints Array of all endpoints
   * @returns Array of endpoints assigned to each worker
   */
  private static distributeEndpoints(
    workersCount: number,
    endpoints: SafeTressiRequestConfig[],
  ): SafeTressiRequestConfig[][] {
    const distribution: SafeTressiRequestConfig[][] = Array.from(
      { length: workersCount },
      () => [],
    );

    endpoints.forEach((endpoint, index) => {
      const workerId = index % workersCount;
      distribution[workerId].push(endpoint);
    });

    return distribution;
  }

  /**
   * Calculates total memory requirements for all shared memory managers.
   *
   * @param workersCount - Number of worker threads
   * @param endpointsCount - Total number of endpoints across all workers
   * @param options - Optional configuration for buffer sizes and histogram parameters
   * @returns Total memory usage in bytes
   *
   * @remarks
   * Provides detailed memory calculation for SharedArrayBuffer allocation planning.
   * Accounts for all memory consumers:
   * - WorkerStateManager: worker state tracking (4 bytes per worker + header)
   * - EndpointStateManager: endpoint state tracking (4 bytes per endpoint)
   * - StatsCounterManager: per-worker request counters and status code tracking
   * - HdrHistogramManager: latency histogram data with configurable precision
   * - BodySampleManager: response body sample storage per endpoint
   *
   * The calculation is conservative and includes overhead for data structure headers.
   * Essential for preventing SharedArrayBuffer allocation failures due to size limits.
   *
   * @example
   * ```typescript
   * const memoryBytes = SharedMemoryFactory.calculateMemoryUsage(
   *   4, // workers
   *   10, // endpoints
   *   { ringBufferSize: 100, bodySampleBufferSize: 1000 }
   * );
   * // Returns: ~2.5MB for typical configuration
   * ```
   */
  static calculateMemoryUsage(
    workersCount: number,
    endpointsCount: number,
    options?: SharedMemoryOptions,
  ): number {
    const {
      ringBufferSize = 100,
      bodySampleBufferSize = 1000,
      significantFigures = 3,
      highestTrackableValue = 120_000_000,
    } = options || {};

    let totalBytes = 0;

    // WorkerStateManager: workersCount * 4 bytes (Int32) + header
    totalBytes += 12 + workersCount * 4;

    // EndpointStateManager: endpointsCount * 4 bytes (Int32)
    totalBytes += endpointsCount * 4;

    // StatsCounterManager per worker: endpointsPerWorker * countersPerEndpoint * 4 bytes
    const endpointsPerWorker = Math.ceil(endpointsCount / workersCount);
    const countersPerEndpoint = 6 + 600 + 600 + ringBufferSize; // 6 header + 600 status codes + 600 counters + ring buffer
    totalBytes +=
      workersCount * (12 + endpointsPerWorker * countersPerEndpoint * 4);

    // HDR histogram bitmap: 19 Uint32 per endpoint per worker
    totalBytes += workersCount * endpointsPerWorker * 19 * 4;

    // HdrHistogramManager per worker: endpointsPerWorker * valuesPerHistogram * 4 bytes
    const subBucketHalfCountMagnitude = Math.ceil(
      Math.log2(significantFigures) + 1,
    );
    const subBucketHalfCount = 1 << subBucketHalfCountMagnitude;
    const largestValueWithSingleUnitResolution = 2 * subBucketHalfCount;
    const bucketsNeeded =
      Math.ceil(
        Math.log2(
          highestTrackableValue / largestValueWithSingleUnitResolution,
        ) / Math.log2(2),
      ) + 1;

    const valuesPerHistogram = bucketsNeeded + 1; // +1 for overflow bucket
    totalBytes +=
      workersCount * (20 + endpointsPerWorker * valuesPerHistogram * 4);

    // BodySampleManager: endpointsCount * fieldsPerEndpoint * 4 bytes
    const fieldsPerEndpoint = 3 + bodySampleBufferSize * 2;
    totalBytes += endpointsCount * fieldsPerEndpoint * 4;

    return totalBytes;
  }

  /**
   * Validates that memory requirements are within SharedArrayBuffer limits.
   *
   * @param workersCount - Number of worker threads
   * @param endpointsCount - Total number of endpoints
   * @param options - Optional configuration for buffer sizes
   * @returns Validation result with requirements and limits
   *
   * @remarks
   * SharedArrayBuffer has a maximum size limit (typically 2GB across browsers and Node.js).
   * This method ensures that the calculated memory requirements don't exceed this limit,
   * preventing runtime allocation failures.
   *
   * Returns detailed information about memory usage and provides clear error messages
   * when requirements exceed limits, helping with configuration tuning.
   *
   * @example
   * ```typescript
   * const validation = SharedMemoryFactory.validateMemoryRequirements(8, 50);
   * if (!validation.valid) {
   *   console.error(`Memory too high: ${validation.error}`);
   *   // Adjust configuration or reduce workers/endpoints
   * }
   * ```
   */
  static validateMemoryRequirements(
    workersCount: number,
    endpointsCount: number,
    options?: SharedMemoryOptions,
  ): {
    valid: boolean;
    requiredBytes: number;
    maxBytes: number;
    error?: string;
  } {
    const requiredBytes = this.calculateMemoryUsage(
      workersCount,
      endpointsCount,
      options,
    );
    const maxBytes = 2 * 1024 * 1024 * 1024; // 2GB limit for SharedArrayBuffer

    if (requiredBytes > maxBytes) {
      return {
        valid: false,
        requiredBytes,
        maxBytes,
        error: `Memory requirement (${requiredBytes} bytes) exceeds maximum allowed (${maxBytes} bytes)`,
      };
    }

    return {
      valid: true,
      requiredBytes,
      maxBytes,
    };
  }

  /**
   * Creates shared memory managers with validation and error handling.
   *
   * @param workersCount - Number of worker threads
   * @param endpoints - Array of endpoint configurations
   * @param options - Optional configuration for buffer sizes
   * @returns Managers object or error if validation/creation fails
   *
   * @remarks
   * Safe wrapper around createManagers that performs memory validation before creation.
   * If memory requirements exceed limits, returns an error object instead of throwing.
   * Also catches and handles any exceptions during manager creation.
   *
   * Recommended for production use where graceful error handling is preferred over exceptions.
   *
   * @example
   * ```typescript
   * const result = SharedMemoryFactory.createManagersSafe(4, endpoints);
   * if ('error' in result) {
   *   console.error(`Failed to create managers: ${result.error}`);
   * } else {
   *   // Use result.workerState, result.endpointState, etc.
   * }
   * ```
   */
  static createManagersSafe(
    workersCount: number,
    endpoints: SafeTressiRequestConfig[],
    options?: SharedMemoryOptions,
  ): ReturnType<typeof SharedMemoryFactory.createManagers> | { error: string } {
    const validation = this.validateMemoryRequirements(
      workersCount,
      endpoints.length,
      options,
    );

    if (!validation.valid) {
      return { error: validation.error! };
    }

    try {
      return this.createManagers(workersCount, endpoints, options);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generates endpoint-to-worker mapping for debugging and analysis.
   *
   * @param workersCount - Number of worker threads
   * @param endpoints - Array of all endpoints
   * @returns Array where index represents endpoint index and value represents assigned worker ID
   *
   * @remarks
   * Useful for debugging load distribution and understanding which worker handles which endpoint.
   * Implements the same round-robin logic used in distributeEndpoints for consistency.
   *
   * @example
   * ```typescript
   * const mapping = SharedMemoryFactory.getEndpointWorkerMapping(3, 7);
   * // Returns: [0, 1, 2, 0, 1, 2, 0]
   * // Endpoint 0 -> Worker 0, Endpoint 1 -> Worker 1, etc.
   * ```
   */
  static getEndpointWorkerMapping(
    workersCount: number,
    endpoints: SafeTressiRequestConfig[],
  ): number[] {
    const mapping: number[] = [];
    endpoints.forEach((_, index) => {
      mapping.push(index % workersCount);
    });
    return mapping;
  }

  /**
   * Calculates the starting endpoint offset for a specific worker.
   *
   * @param workerId - The worker identifier
   * @param workersCount - Total number of workers
   * @param endpointsCount - Total number of endpoints
   * @returns The offset (starting index) for this worker's endpoints
   *
   * @remarks
   * Essential for converting between global endpoint indices and local worker indices.
   * Accounts for uneven distribution when endpoints don't divide evenly among workers.
   * Used by workers to determine their assigned endpoint range in shared memory structures.
   *
   * @example
   * ```typescript
   * // With 5 endpoints and 2 workers:
   * // Worker 0 offset: 0 (handles endpoints 0, 2, 4)
   * // Worker 1 offset: 2 (handles endpoints 1, 3)
   * ```
   */
  static getWorkerEndpointOffset(
    workerId: number,
    workersCount: number,
    endpointsCount: number,
  ): number {
    let offset = 0;
    for (let i = 0; i < workerId; i++) {
      offset +=
        Math.floor(endpointsCount / workersCount) +
        (i < endpointsCount % workersCount ? 1 : 0);
    }
    return offset;
  }
}
