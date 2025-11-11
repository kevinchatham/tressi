import { performance } from 'perf_hooks';

// Removed unused import

/**
 * System metrics for adaptive concurrency management
 */
export interface SystemMetrics {
  eventLoopLag: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  avgLatency: number;
}

/**
 * Configuration for adaptive concurrency management
 */
export interface AdaptiveConcurrencyConfig {
  maxConcurrency: number;
  targetLatency: number;
  memoryThreshold: number;
  enableAdaptiveConcurrency: boolean;
  minConcurrency?: number;
  scaleUpFactor?: number;
  scaleDownFactor?: number;
}

/**
 * Manages dynamic concurrency based on real-time system metrics
 * Replaces fixed worker pools with adaptive resource management
 */
export class AdaptiveConcurrencyManager {
  private currentConcurrency: number;
  private readonly config: Required<AdaptiveConcurrencyConfig>;
  private lastAdjustmentTime = 0;
  private adjustmentInterval = 1000; // 1 second between adjustments
  private requestLatencies: number[] = [];
  private maxLatencyHistory = 100;

  constructor(config: Partial<AdaptiveConcurrencyConfig> = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 10,
      targetLatency: config.targetLatency ?? 100,
      memoryThreshold: config.memoryThreshold ?? 0.8,
      enableAdaptiveConcurrency: config.enableAdaptiveConcurrency ?? true,
      minConcurrency: config.minConcurrency ?? 1,
      scaleUpFactor: config.scaleUpFactor ?? 0.2,
      scaleDownFactor: config.scaleDownFactor ?? 0.3,
    };

    this.currentConcurrency = Math.max(
      1,
      Math.floor(this.config.maxConcurrency / 2),
    );
  }

  /**
   * Calculates the optimal concurrency based on current system metrics
   * @returns The recommended concurrency level
   */
  async calculateOptimalConcurrency(): Promise<number> {
    if (!this.config.enableAdaptiveConcurrency) {
      return this.config.maxConcurrency;
    }

    const now = performance.now();
    if (now - this.lastAdjustmentTime < this.adjustmentInterval) {
      return this.currentConcurrency;
    }

    await this.getSystemMetrics();
    let newConcurrency = this.currentConcurrency;

    // Event loop lag - most critical indicator
    const eventLoopLag = await this.measureEventLoopLag();
    if (eventLoopLag > 50) {
      // High event loop lag indicates system overload
      newConcurrency = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentConcurrency * (1 - this.config.scaleDownFactor)),
      );
      this.lastAdjustmentTime = now;
      this.currentConcurrency = newConcurrency;
      return newConcurrency;
    }

    // Memory pressure
    const memoryUsage = process.memoryUsage();
    const heapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    if (heapRatio > this.config.memoryThreshold) {
      newConcurrency = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentConcurrency * (1 - this.config.scaleDownFactor)),
      );
      this.lastAdjustmentTime = now;
      this.currentConcurrency = newConcurrency;
      return newConcurrency;
    }

    // Request latency feedback
    const avgLatency = this.getAverageLatency();
    if (avgLatency > 0) {
      if (avgLatency > this.config.targetLatency * 1.5) {
        // Latency too high, reduce concurrency
        newConcurrency = Math.max(
          this.config.minConcurrency,
          Math.floor(
            this.currentConcurrency * (1 - this.config.scaleDownFactor),
          ),
        );
      } else if (
        avgLatency < this.config.targetLatency * 0.8 &&
        this.currentConcurrency < this.config.maxConcurrency
      ) {
        // Latency good, can increase concurrency
        newConcurrency = Math.min(
          this.config.maxConcurrency,
          Math.floor(this.currentConcurrency * (1 + this.config.scaleUpFactor)),
        );
      }
    }

    this.lastAdjustmentTime = now;
    this.currentConcurrency = newConcurrency;
    return newConcurrency;
  }

  /**
   * Measures event loop lag using high-resolution timers
   * @returns Event loop lag in milliseconds
   */
  private async measureEventLoopLag(): Promise<number> {
    const start = process.hrtime.bigint();
    await new Promise((resolve) => setImmediate(resolve));
    return Number(process.hrtime.bigint() - start) / 1000000;
  }

  /**
   * Gets current system metrics
   * @returns Current system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      eventLoopLag: await this.measureEventLoopLag(),
      memoryUsage,
      cpuUsage,
      avgLatency: this.getAverageLatency(),
    };
  }

  /**
   * Records a request latency for adaptive calculations
   * @param latencyMs Request latency in milliseconds
   */
  recordLatency(latencyMs: number): void {
    this.requestLatencies.push(latencyMs);
    if (this.requestLatencies.length > this.maxLatencyHistory) {
      this.requestLatencies.shift();
    }
  }

  /**
   * Gets the average latency from recent requests
   * @returns Average latency in milliseconds, or 0 if no data
   */
  private getAverageLatency(): number {
    if (this.requestLatencies.length === 0) {
      return 0;
    }

    const sum = this.requestLatencies.reduce((a, b) => a + b, 0);
    return sum / this.requestLatencies.length;
  }

  /**
   * Gets the current concurrency level
   * @returns Current concurrency level
   */
  getCurrentConcurrency(): number {
    return this.currentConcurrency;
  }

  /**
   * Gets current system metrics for monitoring
   * @returns Current system metrics
   */
  async getMetrics(): Promise<SystemMetrics> {
    return await this.getSystemMetrics();
  }

  /**
   * Updates configuration dynamically
   * @param config New configuration values
   */
  updateConfig(config: Partial<AdaptiveConcurrencyConfig>): void {
    Object.assign(this.config, config);

    // Ensure current concurrency stays within bounds
    this.currentConcurrency = Math.max(
      this.config.minConcurrency,
      Math.min(this.currentConcurrency, this.config.maxConcurrency),
    );
  }

  /**
   * Resets the manager to initial state
   */
  reset(): void {
    this.currentConcurrency = Math.max(
      1,
      Math.floor(this.config.maxConcurrency / 2),
    );
    this.lastAdjustmentTime = 0;
    this.requestLatencies = [];
  }
}
