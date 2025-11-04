import { EventEmitter } from 'events';

/**
 * Configuration for concurrency calculation
 */
export interface ConcurrencyConfig {
  /** Target requests per second */
  targetRps: number;
  /** Maximum number of workers allowed */
  maxWorkers: number;
  /** Scale up threshold as percentage of target RPS (0.0-1.0) */
  scaleUpThreshold?: number;
  /** Scale down threshold as percentage of target RPS (0.0-1.0) */
  scaleDownThreshold?: number;
  /** Scale factor for worker adjustments (0.0-1.0) */
  scaleFactor?: number;
  /** Minimum workers to maintain */
  minWorkers?: number;
}

/**
 * Calculates optimal concurrency levels and manages dynamic worker scaling.
 * This class analyzes current performance metrics and determines when to scale workers up or down.
 */
export class ConcurrencyCalculator extends EventEmitter {
  private config: Required<ConcurrencyConfig>;
  private currentRps: number = 0;
  private currentWorkers: number = 0;

  constructor(config: ConcurrencyConfig) {
    super();

    // Set defaults
    this.config = {
      targetRps: config.targetRps,
      maxWorkers: config.maxWorkers,
      scaleUpThreshold: config.scaleUpThreshold ?? 0.9, // 90% of target
      scaleDownThreshold: config.scaleDownThreshold ?? 1.1, // 110% of target
      scaleFactor: config.scaleFactor ?? 0.25, // 25% adjustments
      minWorkers: config.minWorkers ?? 1,
    };
  }

  /**
   * Updates the current performance metrics.
   * @param currentRps Current requests per second
   * @param currentWorkers Current number of active workers
   */
  updateMetrics(currentRps: number, currentWorkers: number): void {
    this.currentRps = currentRps;
    this.currentWorkers = currentWorkers;
  }

  /**
   * Calculates the recommended worker adjustment.
   * @returns Worker adjustment recommendation
   */
  calculateWorkerAdjustment(): WorkerAdjustment {
    const {
      targetRps,
      scaleUpThreshold,
      scaleDownThreshold,
      scaleFactor,
      maxWorkers,
      minWorkers,
    } = this.config;

    // Calculate thresholds in absolute RPS values
    const scaleUpRpsThreshold = targetRps * scaleUpThreshold;
    const scaleDownRpsThreshold = targetRps * scaleDownThreshold;

    // Determine if scaling is needed
    if (
      this.currentRps < scaleUpRpsThreshold &&
      this.currentWorkers < maxWorkers
    ) {
      // Scale up: need more workers
      const rpsDeficit = targetRps - this.currentRps;
      const avgRpsPerWorker =
        this.currentWorkers > 0
          ? this.currentRps / this.currentWorkers
          : targetRps / 10;
      const workersNeeded = rpsDeficit / avgRpsPerWorker;
      let workersToAdd = Math.ceil(workersNeeded * scaleFactor);

      // Apply constraints
      workersToAdd = Math.max(1, workersToAdd); // Add at least 1 worker
      workersToAdd = Math.min(workersToAdd, maxWorkers - this.currentWorkers); // Don't exceed max

      return {
        action: 'SCALE_UP',
        workersToAdd,
        reason: `Current RPS (${this.currentRps.toFixed(1)}) is below scale-up threshold (${scaleUpRpsThreshold.toFixed(1)})`,
      };
    } else if (
      this.currentRps > scaleDownRpsThreshold &&
      this.currentWorkers > minWorkers
    ) {
      // Scale down: too many workers
      const rpsSurplus = this.currentRps - targetRps;
      const avgRpsPerWorker = this.currentRps / this.currentWorkers;
      const workersToCut = rpsSurplus / avgRpsPerWorker;
      let workersToRemove = Math.ceil(workersToCut * scaleFactor);

      // Apply constraints
      workersToRemove = Math.max(1, workersToRemove); // Remove at least 1 worker
      workersToRemove = Math.min(
        workersToRemove,
        this.currentWorkers - minWorkers,
      ); // Don't go below min

      return {
        action: 'SCALE_DOWN',
        workersToRemove,
        reason: `Current RPS (${this.currentRps.toFixed(1)}) is above scale-down threshold (${scaleDownRpsThreshold.toFixed(1)})`,
      };
    }

    // No scaling needed
    return {
      action: 'MAINTAIN',
      reason: `Current RPS (${this.currentRps.toFixed(1)}) is within thresholds (${scaleUpRpsThreshold.toFixed(1)}-${scaleDownRpsThreshold.toFixed(1)})`,
    };
  }

  /**
   * Calculates the optimal concurrency level for a single worker.
   * @param targetRpsPerWorker Target RPS for this worker
   * @returns Optimal concurrency level
   */
  calculateOptimalConcurrency(targetRpsPerWorker: number): number {
    if (targetRpsPerWorker <= 0) {
      return 10; // Default concurrency
    }

    // Dynamic calculation: ensure we can meet target RPS with reasonable concurrency
    // Allow up to 50 concurrent requests per worker, but at least 1
    return Math.min(50, Math.max(1, Math.ceil(targetRpsPerWorker)));
  }

  /**
   * Calculates the target RPS per worker based on current worker count.
   * @returns Target RPS per worker
   */
  calculateTargetRpsPerWorker(): number {
    if (this.currentWorkers <= 0) {
      return this.config.targetRps / 10; // Assume 10 workers if none active
    }
    return this.config.targetRps / this.currentWorkers;
  }

  /**
   * Determines if the current configuration is optimal.
   * @returns true if configuration is optimal, false if adjustment needed
   */
  isConfigurationOptimal(): boolean {
    const adjustment = this.calculateWorkerAdjustment();
    return adjustment.action === 'MAINTAIN';
  }

  /**
   * Gets the current configuration.
   * @returns Current configuration
   */
  getConfig(): Required<ConcurrencyConfig> {
    return { ...this.config };
  }

  /**
   * Updates the configuration.
   * @param newConfig New configuration values
   */
  updateConfig(newConfig: Partial<ConcurrencyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Gets current performance metrics.
   * @returns Current metrics
   */
  getMetrics(): ConcurrencyMetrics {
    return {
      currentRps: this.currentRps,
      currentWorkers: this.currentWorkers,
      targetRps: this.config.targetRps,
      utilization:
        this.config.targetRps > 0
          ? (this.currentRps / this.config.targetRps) * 100
          : 0,
    };
  }
}

/**
 * Worker adjustment recommendation
 */
export interface WorkerAdjustment {
  action: 'SCALE_UP' | 'SCALE_DOWN' | 'MAINTAIN';
  workersToAdd?: number;
  workersToRemove?: number;
  reason: string;
}

/**
 * Concurrency performance metrics
 */
export interface ConcurrencyMetrics {
  currentRps: number;
  currentWorkers: number;
  targetRps: number;
  utilization: number;
}
