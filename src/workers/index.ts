// Worker management components
export { WorkerPool } from './worker-pool';
export { WorkerController } from './worker-controller';
export { ConcurrencyCalculator } from './concurrency-calculator';

// Re-export types for convenience
export type { Worker, WorkerPoolStats } from './worker-pool';
export type {
  ConcurrencyConfig,
  WorkerAdjustment,
  ConcurrencyMetrics,
} from './concurrency-calculator';
