/**
 * Manages memory usage and cleanup for quadrant components
 */
export class QuadrantMemoryManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_MEMORY_AGE = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly MAX_BUFFER_SIZE = 1000; // Maximum buffer size before cleanup

  private bufferSizes: Map<string, number> = new Map();
  private lastAccessTimes: Map<string, number> = new Map();

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Start the automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Perform cleanup of old data
   */
  private performCleanup(): void {
    const now = Date.now();
    const oldKeys: string[] = [];

    // Find old data
    for (const [key, lastAccess] of this.lastAccessTimes.entries()) {
      if (now - lastAccess > this.MAX_MEMORY_AGE) {
        oldKeys.push(key);
      }
    }

    // Clean up old buffers
    for (const key of oldKeys) {
      this.cleanupBuffer(key);
    }

    // Clean up large buffers
    for (const [key, size] of this.bufferSizes.entries()) {
      if (size > this.MAX_BUFFER_SIZE) {
        this.cleanupBuffer(key);
      }
    }
  }

  /**
   * Clean up a specific buffer
   */
  private cleanupBuffer(key: string): void {
    this.bufferSizes.delete(key);
    this.lastAccessTimes.delete(key);
  }

  /**
   * Register a buffer for memory tracking
   */
  registerBuffer(key: string, size: number): void {
    this.bufferSizes.set(key, size);
    this.lastAccessTimes.set(key, Date.now());
  }

  /**
   * Update buffer access time
   */
  updateAccessTime(key: string): void {
    this.lastAccessTimes.set(key, Date.now());
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): {
    totalBuffers: number;
    totalSize: number;
    oldBuffers: number;
    largeBuffers: number;
  } {
    const now = Date.now();
    let oldBuffers = 0;
    let largeBuffers = 0;
    let totalSize = 0;

    for (const [, lastAccess] of this.lastAccessTimes.entries()) {
      if (now - lastAccess > this.MAX_MEMORY_AGE) {
        oldBuffers++;
      }
    }

    for (const size of this.bufferSizes.values()) {
      totalSize += size;
      if (size > this.MAX_BUFFER_SIZE) {
        largeBuffers++;
      }
    }

    return {
      totalBuffers: this.bufferSizes.size,
      totalSize,
      oldBuffers,
      largeBuffers,
    };
  }

  /**
   * Force cleanup of all buffers
   */
  forceCleanup(): void {
    this.bufferSizes.clear();
    this.lastAccessTimes.clear();
  }

  /**
   * Get memory usage in MB
   */
  getMemoryUsageMB(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024);
  }

  /**
   * Check if memory usage is healthy
   */
  isMemoryHealthy(): boolean {
    const memUsageMB = this.getMemoryUsageMB();
    const stats = this.getMemoryStats();

    return (
      memUsageMB < 100 && // Less than 100MB
      stats.oldBuffers < 5 && // Few old buffers
      stats.largeBuffers < 3 // Few large buffers
    );
  }

  /**
   * Get memory optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getMemoryStats();
    const memUsageMB = this.getMemoryUsageMB();

    if (memUsageMB > 100) {
      recommendations.push(
        `High memory usage: ${memUsageMB}MB - consider reducing buffer sizes`,
      );
    }

    if (stats.oldBuffers > 10) {
      recommendations.push(
        `${stats.oldBuffers} old buffers detected - cleanup may be needed`,
      );
    }

    if (stats.largeBuffers > 5) {
      recommendations.push(
        `${stats.largeBuffers} large buffers detected - consider size limits`,
      );
    }

    return recommendations;
  }

  /**
   * Destroy the memory manager and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.forceCleanup();
  }
}
