import { CircularBuffer } from '../utils/circular-buffer';

type BufferData = string | number;

/**
 * Manages circular buffers for all quadrants with optimized update strategies
 */
export class QuadrantBufferManager {
  private static readonly BUFFER_SIZES = {
    TIME_SERIES: 100, // 100 data points for historical charts
    GAUGE_CURRENT: 1, // Only current value for gauges
    TABLE_SUMMARY: 50, // 50 rows max for table views
    STATUS_CODES: 20, // Top 20 status codes max
  };

  private buffers: Map<string, CircularBuffer<BufferData>> = new Map();
  private updateThrottles: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdateTimes: Map<string, number> = new Map();

  constructor() {
    this.initializeBuffers();
  }

  /**
   * Initialize all buffers for each quadrant
   */
  private initializeBuffers(): void {
    const bufferSizes = QuadrantBufferManager.BUFFER_SIZES;

    // Quadrant 1: RPS data
    this.buffers.set(
      'quadrant1-time',
      new CircularBuffer<string>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant1-actual-rps',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant1-target-rps',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant1-success-rps',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant1-error-rps',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );

    // Quadrant 2: Latency data
    this.buffers.set(
      'quadrant2-time',
      new CircularBuffer<string>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-p50',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-p95',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-p99',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-avg',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-min',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-max',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );

    // Quadrant 3: System metrics
    this.buffers.set(
      'quadrant3-cpu',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant3-memory',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant3-network',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );

    // Quadrant 4: Status codes
    this.buffers.set(
      'quadrant4-2xx',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant4-3xx',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant4-4xx',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant4-5xx',
      new CircularBuffer<number>(bufferSizes.TIME_SERIES),
    );
  }

  /**
   * Batch update multiple data points to reduce render frequency
   */
  batchUpdate(quadrantId: string, data: BufferData[]): void {
    const buffer = this.buffers.get(quadrantId);
    if (buffer) {
      data.forEach((item) => buffer.add(item));
    }
  }

  /**
   * Throttled update to prevent UI blocking
   */
  throttledUpdate(
    quadrantId: string,
    data: BufferData,
    throttleMs: number = 500,
  ): void {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTimes.get(quadrantId) || 0;

    if (now - lastUpdate >= throttleMs) {
      // Update immediately
      this.update(quadrantId, data);
      this.lastUpdateTimes.set(quadrantId, now);
    } else {
      // Schedule update for later
      const existingTimeout = this.updateThrottles.get(quadrantId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(
        () => {
          this.update(quadrantId, data);
          this.lastUpdateTimes.set(quadrantId, Date.now());
          this.updateThrottles.delete(quadrantId);
        },
        throttleMs - (now - lastUpdate),
      );

      this.updateThrottles.set(quadrantId, timeout);
    }
  }

  /**
   * Direct update without throttling
   */
  update(quadrantId: string, data: BufferData): void {
    const buffer = this.buffers.get(quadrantId);
    if (buffer) {
      buffer.add(data);
    }
  }

  /**
   * Get buffer data
   */
  getBuffer(quadrantId: string): CircularBuffer<BufferData> | undefined {
    return this.buffers.get(quadrantId);
  }

  /**
   * Get all data from a buffer
   */
  getAllData(quadrantId: string): BufferData[] {
    const buffer = this.buffers.get(quadrantId);
    return buffer ? buffer.getAll() : [];
  }

  /**
   * Get current buffer size
   */
  getBufferSize(quadrantId: string): number {
    const buffer = this.buffers.get(quadrantId);
    return buffer ? buffer.size() : 0;
  }

  /**
   * Clear specific buffer
   */
  clearBuffer(quadrantId: string): void {
    const buffer = this.buffers.get(quadrantId);
    if (buffer) {
      // Create new buffer with same capacity
      const capacity = this.getBufferCapacity(buffer);
      this.buffers.set(quadrantId, new CircularBuffer<BufferData>(capacity));
    }
  }

  /**
   * Get buffer capacity
   */
  private getBufferCapacity(buffer: CircularBuffer<BufferData>): number {
    // Access the private capacity property through reflection or type assertion
    return (
      (buffer as unknown as { capacity?: number }).capacity ||
      QuadrantBufferManager.BUFFER_SIZES.TIME_SERIES
    );
  }

  /**
   * Clear all buffers
   */
  clearAll(): void {
    this.buffers.forEach((_buffer, quadrantId) => {
      this.clearBuffer(quadrantId);
    });
    this.updateThrottles.forEach((timeout) => clearTimeout(timeout));
    this.updateThrottles.clear();
    this.lastUpdateTimes.clear();
  }

  /**
   * Get buffer statistics for performance monitoring
   */
  getBufferStats(): Record<string, { size: number; capacity: number }> {
    const stats: Record<string, { size: number; capacity: number }> = {};

    this.buffers.forEach((buffer, quadrantId) => {
      stats[quadrantId] = {
        size: buffer.size(),
        capacity: this.getBufferCapacity(buffer),
      };
    });

    return stats;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearAll();
  }
}
