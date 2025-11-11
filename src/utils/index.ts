// Object pooling utilities
export { ObjectPool, HeadersPool, ResultPool } from './object-pool';

// Endpoint caching utilities
export { EndpointCache, globalEndpointCache } from './endpoint-cache';

// Resource management utilities
export {
  ResourceManager,
  globalResourceManager,
  Resource,
  HttpAgentResource,
  TimerResource,
  IntervalResource,
  ObjectPoolResource,
  MapResource,
} from './resource-manager';

// Safe directory and file name utilities
export {
  getSafeDirectoryName,
  isValidDirectoryName,
  getSafeFileName,
  getFileExtension,
  removeFileExtension,
  combineSafeFileName,
} from './safe-directory';

// Circular buffer utility (moved from root)
export { CircularBuffer } from './circular-buffer';

// File system utilities
export { FileUtils } from './file-utils';

// Validation utilities - now handled by unified validator
// export { ValidationUtils } from './validation-utils'; // Removed - use ConfigValidator instead

// Re-export types for convenience
// export type { WorkerPoolStats } from '../workers/worker-pool';
// export type { ConcurrencyMetrics } from '../workers/concurrency-calculator';
