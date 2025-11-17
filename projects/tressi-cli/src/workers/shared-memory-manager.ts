import type { EndpointStats, GlobalStats, SharedMetrics } from 'tressi-common';

export class SharedMemoryManager {
  private sharedMetrics: SharedMetrics;
  private buffer: SharedArrayBuffer;
  private endpointsCount: number;
  private workersCount: number;
  private bufferSize: number;

  constructor(
    workersCount: number,
    endpointsCount: number,
    bufferSize: number = 10000,
  ) {
    this.workersCount = workersCount;
    this.endpointsCount = endpointsCount;
    this.bufferSize = bufferSize;

    // Calculate total buffer size needed
    const totalSize = this.calculateBufferSize();

    try {
      this.buffer = new SharedArrayBuffer(totalSize);
    } catch (error) {
      throw new Error(`Failed to create SharedArrayBuffer: ${error}`);
    }

    this.sharedMetrics = this.createSharedMetrics();
  }

  static fromBuffer(
    buffer: SharedArrayBuffer,
    workersCount: number,
    endpointsCount: number,
    bufferSize: number = 10000,
  ): SharedMemoryManager {
    const manager = Object.create(SharedMemoryManager.prototype);
    manager.buffer = buffer;
    manager.workersCount = workersCount;
    manager.endpointsCount = endpointsCount;
    manager.bufferSize = bufferSize;
    manager.sharedMetrics = manager.createSharedMetrics();
    return manager;
  }

  private calculateBufferSize(): number {
    // Global counters: 20 bytes
    let size = 20;

    // Per-endpoint counters: 12 bytes * endpoints * workers
    size += 12 * this.endpointsCount * this.workersCount;

    // Align for Float64Array (startTime)
    size = Math.ceil(size / 8) * 8;

    // startTime: 8 bytes
    size += 8;

    // Global latency data: 8 bytes * bufferSize * workers
    size += 8 * this.bufferSize * this.workersCount;

    // Global latency write indices: 4 bytes * workers
    size += 4 * this.workersCount;

    // Per-endpoint latency data: 8 bytes * bufferSize * workers * endpoints
    size += 8 * this.bufferSize * this.workersCount * this.endpointsCount;

    // Per-endpoint latency write indices: 4 bytes * workers * endpoints
    size += 4 * this.workersCount * this.endpointsCount;

    // Worker status: 4 bytes * workers
    size += 4 * this.workersCount;

    // Control flags: 4 bytes
    size += 4;

    // Early exit coordination: 4 bytes * endpoints + 4 bytes * 2 + 4 bytes * 2
    size += 4 * this.endpointsCount + 8 + 8;

    // Status code tracking: 4 bytes * 600 (status codes 100-599)
    size += 4 * 600;

    // Per-endpoint status codes: 4 bytes * 600 * endpoints * workers
    size += 4 * 600 * this.endpointsCount * this.workersCount;

    // Network bandwidth tracking (8 bytes * 2 global + 8 bytes * 2 * endpoints * workers)
    size += 8 * 2; // Global network bytes sent/received
    size += 8 * 2 * this.endpointsCount * this.workersCount; // Per-endpoint network bytes

    // Final alignment to ensure 8-byte boundary
    size = Math.ceil(size / 8) * 8;

    return size;
  }

  private createSharedMetrics(): SharedMetrics {
    let offset = 0;

    // Global counters (20 bytes)
    const totalRequests = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    const successfulRequests = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    const failedRequests = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    // Ensure 8-byte alignment for Float64Array
    offset = Math.ceil(offset / 8) * 8;

    const startTime = new Float64Array(this.buffer, offset, 1);
    offset += 8;

    // Per-endpoint counters (12 bytes * endpoints * workers)
    const endpointRequests = new Int32Array(
      this.buffer,
      offset,
      this.endpointsCount * this.workersCount,
    );
    offset += 4 * this.endpointsCount * this.workersCount;

    const endpointSuccess = new Int32Array(
      this.buffer,
      offset,
      this.endpointsCount * this.workersCount,
    );
    offset += 4 * this.endpointsCount * this.workersCount;

    const endpointFailures = new Int32Array(
      this.buffer,
      offset,
      this.endpointsCount * this.workersCount,
    );
    offset += 4 * this.endpointsCount * this.workersCount;

    // Ensure 8-byte alignment for latencyBuffer Float64Array
    offset = Math.ceil(offset / 8) * 8;

    // Latency data (8 bytes * bufferSize * workers)
    const latencyBuffer = new Float64Array(
      this.buffer,
      offset,
      this.bufferSize * this.workersCount,
    );
    offset += 8 * this.bufferSize * this.workersCount;

    // Latency write indices (4 bytes * workers)
    const latencyWriteIndex = new Int32Array(
      this.buffer,
      offset,
      this.workersCount,
    );
    offset += 4 * this.workersCount;

    // Per-endpoint latency data (8 bytes * bufferSize * workers * endpoints)
    const endpointLatencyBuffer = new Float64Array(
      this.buffer,
      offset,
      this.bufferSize * this.workersCount * this.endpointsCount,
    );
    offset += 8 * this.bufferSize * this.workersCount * this.endpointsCount;

    // Per-endpoint latency write indices (4 bytes * workers * endpoints)
    const endpointLatencyWriteIndex = new Int32Array(
      this.buffer,
      offset,
      this.workersCount * this.endpointsCount,
    );
    offset += 4 * this.workersCount * this.endpointsCount;

    // Worker status (4 bytes * workers)
    const workerStatus = new Int32Array(this.buffer, offset, this.workersCount);
    offset += 4 * this.workersCount;

    // Shutdown flag (4 bytes)
    const shutdownFlag = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    // Early exit coordination
    const earlyExitTriggered = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    const endpointEarlyExit = new Int32Array(
      this.buffer,
      offset,
      this.endpointsCount,
    );
    offset += 4 * this.endpointsCount;

    const globalErrorCount = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    const globalRequestCount = new Int32Array(this.buffer, offset, 1);
    offset += 4;

    // Status code tracking
    const statusCodeCounts = new Int32Array(this.buffer, offset, 600);
    offset += 4 * 600;

    const endpointStatusCodeCounts = new Int32Array(
      this.buffer,
      offset,
      600 * this.endpointsCount * this.workersCount,
    );
    offset += 4 * 600 * this.endpointsCount * this.workersCount;

    // Ensure 8-byte alignment for network bandwidth tracking
    offset = Math.ceil(offset / 8) * 8;

    // Network bandwidth tracking (8 bytes * 2 global)
    const networkBytesSent = new Float64Array(this.buffer, offset, 1);
    offset += 8;

    const networkBytesReceived = new Float64Array(this.buffer, offset, 1);
    offset += 8;

    // Per-endpoint network bandwidth tracking (8 bytes * 2 * endpoints * workers)
    const endpointNetworkBytesSent = new Float64Array(
      this.buffer,
      offset,
      this.endpointsCount * this.workersCount,
    );
    offset += 8 * this.endpointsCount * this.workersCount;

    const endpointNetworkBytesReceived = new Float64Array(
      this.buffer,
      offset,
      this.endpointsCount * this.workersCount,
    );

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      startTime,
      endpointRequests,
      endpointSuccess,
      endpointFailures,
      latencyBuffer,
      latencyWriteIndex,
      endpointLatencyBuffer,
      endpointLatencyWriteIndex,
      workerStatus,
      shutdownFlag,
      earlyExitTriggered,
      endpointEarlyExit,
      globalErrorCount,
      globalRequestCount,
      networkBytesSent,
      networkBytesReceived,
      endpointNetworkBytesSent,
      endpointNetworkBytesReceived,
      statusCodeCounts,
      endpointStatusCodeCounts,
    };
  }

  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  setWorkerStatus(workerId: number, status: number): void {
    Atomics.store(this.sharedMetrics.workerStatus, workerId, status);
  }

  getWorkerStatus(workerId: number): number {
    return Atomics.load(this.sharedMetrics.workerStatus, workerId);
  }

  recordResult(
    workerId: number,
    result: {
      success: boolean;
      latency: number;
      endpointIndex: number;
      statusCode?: number;
      bytesSent?: number;
      bytesReceived?: number;
    },
  ): void {
    // Validate inputs to prevent corruption
    if (workerId < 0 || workerId >= this.workersCount) {
      // eslint-disable-next-line no-console
      console.error(`Invalid workerId: ${workerId}`);
      return;
    }
    if (
      result.endpointIndex < 0 ||
      result.endpointIndex >= this.endpointsCount
    ) {
      // eslint-disable-next-line no-console
      console.error(`Invalid endpointIndex: ${result.endpointIndex}`);
      return;
    }
    if (result.latency < 0 || result.latency > 60000) {
      // Cap at 60s
      result.latency = 60000;
    }

    // Update global counters
    Atomics.add(this.sharedMetrics.totalRequests, 0, 1);
    if (result.success) {
      Atomics.add(this.sharedMetrics.successfulRequests, 0, 1);
    } else {
      Atomics.add(this.sharedMetrics.failedRequests, 0, 1);
    }

    // Update per-endpoint counters
    const endpointOffset =
      workerId * this.endpointsCount + result.endpointIndex;
    if (endpointOffset < this.sharedMetrics.endpointRequests.length) {
      Atomics.add(this.sharedMetrics.endpointRequests, endpointOffset, 1);
      if (result.success) {
        Atomics.add(this.sharedMetrics.endpointSuccess, endpointOffset, 1);
      } else {
        Atomics.add(this.sharedMetrics.endpointFailures, endpointOffset, 1);
      }
    }

    // Record status code if provided
    if (
      result.statusCode &&
      result.statusCode >= 100 &&
      result.statusCode <= 599
    ) {
      // Global status code count
      Atomics.add(this.sharedMetrics.statusCodeCounts, result.statusCode, 1);

      // Per-endpoint status code count
      const endpointStatusOffset =
        (workerId * this.endpointsCount + result.endpointIndex) * 600 +
        result.statusCode;
      if (
        endpointStatusOffset <
        this.sharedMetrics.endpointStatusCodeCounts.length
      ) {
        Atomics.add(
          this.sharedMetrics.endpointStatusCodeCounts,
          endpointStatusOffset,
          1,
        );
      }
    }

    // Record latency with bounds checking
    const writeIndex = this.getLatencyWriteIndex(workerId);
    if (writeIndex < this.bufferSize) {
      const latencyOffset = workerId * this.bufferSize + writeIndex;
      if (latencyOffset < this.sharedMetrics.latencyBuffer.length) {
        this.sharedMetrics.latencyBuffer[latencyOffset] = result.latency;
        Atomics.add(this.sharedMetrics.latencyWriteIndex, workerId, 1);
        if (this.getLatencyWriteIndex(workerId) >= this.bufferSize) {
          Atomics.store(this.sharedMetrics.latencyWriteIndex, workerId, 0);
        }
      }
    }

    // Record per-endpoint latency
    const endpointWriteIndex = this.getEndpointLatencyWriteIndex(
      workerId,
      result.endpointIndex,
    );
    if (endpointWriteIndex < this.bufferSize) {
      const endpointLatencyOffset =
        (workerId * this.endpointsCount + result.endpointIndex) *
          this.bufferSize +
        endpointWriteIndex;
      if (
        endpointLatencyOffset < this.sharedMetrics.endpointLatencyBuffer.length
      ) {
        this.sharedMetrics.endpointLatencyBuffer[endpointLatencyOffset] =
          result.latency;
        const endpointWriteOffset =
          workerId * this.endpointsCount + result.endpointIndex;
        Atomics.add(
          this.sharedMetrics.endpointLatencyWriteIndex,
          endpointWriteOffset,
          1,
        );
        if (
          this.getEndpointLatencyWriteIndex(workerId, result.endpointIndex) >=
          this.bufferSize
        ) {
          const writeOffset =
            workerId * this.endpointsCount + result.endpointIndex;
          Atomics.store(
            this.sharedMetrics.endpointLatencyWriteIndex,
            writeOffset,
            0,
          );
        }
      }
    }

    // Update network bandwidth tracking
    if (result.bytesSent && result.bytesSent > 0) {
      this.sharedMetrics.networkBytesSent[0] += result.bytesSent;

      // Update per-endpoint network bytes
      const endpointNetworkOffset =
        workerId * this.endpointsCount + result.endpointIndex;
      if (
        endpointNetworkOffset <
        this.sharedMetrics.endpointNetworkBytesSent.length
      ) {
        this.sharedMetrics.endpointNetworkBytesSent[endpointNetworkOffset] +=
          result.bytesSent;
      }
    }

    if (result.bytesReceived && result.bytesReceived > 0) {
      this.sharedMetrics.networkBytesReceived[0] += result.bytesReceived;

      // Update per-endpoint network bytes
      const endpointNetworkOffset =
        workerId * this.endpointsCount + result.endpointIndex;
      if (
        endpointNetworkOffset <
        this.sharedMetrics.endpointNetworkBytesReceived.length
      ) {
        this.sharedMetrics.endpointNetworkBytesReceived[
          endpointNetworkOffset
        ] += result.bytesReceived;
      }
    }

    // Update global counters for early exit
    Atomics.add(this.sharedMetrics.globalRequestCount, 0, 1);
    if (!result.success) {
      Atomics.add(this.sharedMetrics.globalErrorCount, 0, 1);
    }
  }

  recordError(workerId: number, endpointIndex: number): void {
    // Update global counters
    Atomics.add(this.sharedMetrics.totalRequests, 0, 1);
    Atomics.add(this.sharedMetrics.failedRequests, 0, 1);

    // Update per-endpoint counters
    const endpointOffset = workerId * this.endpointsCount + endpointIndex;
    Atomics.add(this.sharedMetrics.endpointRequests, endpointOffset, 1);
    Atomics.add(this.sharedMetrics.endpointFailures, endpointOffset, 1);

    // Update global counters for early exit
    Atomics.add(this.sharedMetrics.globalRequestCount, 0, 1);
    Atomics.add(this.sharedMetrics.globalErrorCount, 0, 1);
  }

  private getLatencyWriteIndex(workerId: number): number {
    return Atomics.load(this.sharedMetrics.latencyWriteIndex, workerId);
  }

  private getEndpointLatencyWriteIndex(
    workerId: number,
    endpointIndex: number,
  ): number {
    const offset = workerId * this.endpointsCount + endpointIndex;
    return Atomics.load(this.sharedMetrics.endpointLatencyWriteIndex, offset);
  }

  shouldShutdown(): boolean {
    return Atomics.load(this.sharedMetrics.shutdownFlag, 0) === 1;
  }

  signalShutdown(): void {
    Atomics.store(this.sharedMetrics.shutdownFlag, 0, 1);
  }

  setEarlyExitFlag(trigger: boolean): void {
    Atomics.store(this.sharedMetrics.earlyExitTriggered, 0, trigger ? 1 : 0);
  }

  shouldEarlyExit(endpointIndex: number): boolean {
    return (
      Atomics.load(this.sharedMetrics.endpointEarlyExit, endpointIndex) === 1
    );
  }

  setEndpointExitFlag(endpointIndex: number, trigger: boolean): void {
    Atomics.store(
      this.sharedMetrics.endpointEarlyExit,
      endpointIndex,
      trigger ? 1 : 0,
    );
  }

  getGlobalStats(): GlobalStats {
    const totalRequests = Atomics.load(this.sharedMetrics.totalRequests, 0);
    const successfulRequests = Atomics.load(
      this.sharedMetrics.successfulRequests,
      0,
    );
    const failedRequests = Atomics.load(this.sharedMetrics.failedRequests, 0);
    const totalErrors = failedRequests;
    const networkBytesSent = this.sharedMetrics.networkBytesSent[0];
    const networkBytesReceived = this.sharedMetrics.networkBytesReceived[0];

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      networkBytesSent,
      networkBytesReceived,
    };
  }

  getEndpointStats(endpoints?: string[]): EndpointStats {
    const stats: EndpointStats = {};

    for (
      let endpointIndex = 0;
      endpointIndex < this.endpointsCount;
      endpointIndex++
    ) {
      let totalRequests = 0;
      let totalErrors = 0;
      let totalNetworkBytesSent = 0;
      let totalNetworkBytesReceived = 0;

      for (let workerId = 0; workerId < this.workersCount; workerId++) {
        const offset = workerId * this.endpointsCount + endpointIndex;
        if (offset < this.sharedMetrics.endpointRequests.length) {
          const requests = Atomics.load(
            this.sharedMetrics.endpointRequests,
            offset,
          );
          const errors = Atomics.load(
            this.sharedMetrics.endpointFailures,
            offset,
          );

          // Filter out garbage values (negative or impossibly high)
          if (requests >= 0 && requests <= 1000000) {
            totalRequests += requests;
          }
          if (errors >= 0 && errors <= 1000000) {
            totalErrors += errors;
          }
        }

        // Aggregate network bytes for this endpoint
        if (offset < this.sharedMetrics.endpointNetworkBytesSent.length) {
          const bytesSent = this.sharedMetrics.endpointNetworkBytesSent[offset];
          const bytesReceived =
            this.sharedMetrics.endpointNetworkBytesReceived[offset];

          if (bytesSent >= 0 && bytesSent <= 1e12) {
            // Reasonable upper limit
            totalNetworkBytesSent += bytesSent;
          }
          if (bytesReceived >= 0 && bytesReceived <= 1e12) {
            totalNetworkBytesReceived += bytesReceived;
          }
        }
      }

      // Use actual endpoint URL if provided, otherwise use index
      const endpointKey =
        endpoints?.[endpointIndex] || `endpoint_${endpointIndex}`;

      if (totalRequests > 0) {
        stats[endpointKey] = {
          totalRequests: totalRequests,
          totalErrors: totalErrors,
          errorRate: totalErrors / totalRequests,
          errorCount: totalErrors,
          networkBytesSent: totalNetworkBytesSent,
          networkBytesReceived: totalNetworkBytesReceived,
        };
      }
    }

    return stats;
  }

  getLatencyData(workerId: number): number[] {
    const latencies: number[] = [];
    const writeIndex = this.getLatencyWriteIndex(workerId);

    for (let i = 0; i < Math.min(writeIndex, this.bufferSize); i++) {
      const offset = workerId * this.bufferSize + i;
      const latency = this.sharedMetrics.latencyBuffer[offset];
      if (latency > 0) {
        latencies.push(latency);
      }
    }

    return latencies;
  }

  getEndpointLatencyData(workerId: number, endpointIndex: number): number[] {
    const latencies: number[] = [];
    const writeIndex = this.getEndpointLatencyWriteIndex(
      workerId,
      endpointIndex,
    );

    for (let i = 0; i < Math.min(writeIndex, this.bufferSize); i++) {
      const offset =
        (workerId * this.endpointsCount + endpointIndex) * this.bufferSize + i;
      const latency = this.sharedMetrics.endpointLatencyBuffer[offset];
      if (latency > 0) {
        latencies.push(latency);
      }
    }

    return latencies;
  }

  reset(): void {
    // Reset all counters
    Atomics.store(this.sharedMetrics.totalRequests, 0, 0);
    Atomics.store(this.sharedMetrics.successfulRequests, 0, 0);
    Atomics.store(this.sharedMetrics.failedRequests, 0, 0);
    this.sharedMetrics.startTime[0] = 0;
    Atomics.store(this.sharedMetrics.shutdownFlag, 0, 0);
    Atomics.store(this.sharedMetrics.earlyExitTriggered, 0, 0);
    Atomics.store(this.sharedMetrics.globalErrorCount, 0, 0);
    Atomics.store(this.sharedMetrics.globalRequestCount, 0, 0);

    // Reset arrays
    for (let i = 0; i < this.endpointsCount * this.workersCount; i++) {
      Atomics.store(this.sharedMetrics.endpointRequests, i, 0);
      Atomics.store(this.sharedMetrics.endpointSuccess, i, 0);
      Atomics.store(this.sharedMetrics.endpointFailures, i, 0);
    }

    for (let i = 0; i < this.workersCount; i++) {
      Atomics.store(this.sharedMetrics.workerStatus, i, 0);
      Atomics.store(this.sharedMetrics.latencyWriteIndex, i, 0);
    }

    for (let i = 0; i < this.endpointsCount; i++) {
      Atomics.store(this.sharedMetrics.endpointEarlyExit, i, 0);
    }

    // Reset per-endpoint latency arrays
    for (let i = 0; i < this.workersCount * this.endpointsCount; i++) {
      Atomics.store(this.sharedMetrics.endpointLatencyWriteIndex, i, 0);
    }

    // Reset network bandwidth counters
    this.sharedMetrics.networkBytesSent[0] = 0;
    this.sharedMetrics.networkBytesReceived[0] = 0;

    // Reset per-endpoint network counters
    for (let i = 0; i < this.endpointsCount * this.workersCount; i++) {
      this.sharedMetrics.endpointNetworkBytesSent[i] = 0;
      this.sharedMetrics.endpointNetworkBytesReceived[i] = 0;
    }

    // Reset status code counts
    for (let i = 0; i < 600; i++) {
      Atomics.store(this.sharedMetrics.statusCodeCounts, i, 0);
    }

    // Reset per-endpoint status code counts
    for (let i = 0; i < 600 * this.endpointsCount * this.workersCount; i++) {
      Atomics.store(this.sharedMetrics.endpointStatusCodeCounts, i, 0);
    }

    // Set start time
    this.sharedMetrics.startTime[0] = Date.now();
  }

  /**
   * Gets the global status code distribution
   * @returns Record mapping status codes to their counts
   */
  getStatusCodeDistribution(): Record<number, number> {
    const distribution: Record<number, number> = {};
    for (let status = 100; status <= 599; status++) {
      const count = Atomics.load(this.sharedMetrics.statusCodeCounts, status);
      if (count > 0) {
        distribution[status] = count;
      }
    }
    return distribution;
  }

  /**
   * Gets the per-endpoint status code distribution
   * @param endpointIndex The endpoint index
   * @returns Record mapping status codes to their counts for the endpoint
   */
  getEndpointStatusCodeDistribution(
    endpointIndex: number,
  ): Record<number, number> {
    const distribution: Record<number, number> = {};

    // Sum across all workers for this endpoint
    for (let status = 100; status <= 599; status++) {
      let totalCount = 0;
      for (let workerId = 0; workerId < this.workersCount; workerId++) {
        const offset =
          (workerId * this.endpointsCount + endpointIndex) * 600 + status;
        if (offset < this.sharedMetrics.endpointStatusCodeCounts.length) {
          totalCount += Atomics.load(
            this.sharedMetrics.endpointStatusCodeCounts,
            offset,
          );
        }
      }
      if (totalCount > 0) {
        distribution[status] = totalCount;
      }
    }

    return distribution;
  }
}
