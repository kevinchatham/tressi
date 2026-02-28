import { TestSummary } from './reporting.types';

export type TestStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | null;

/**
 * Options for running a load test.
 */
export type LoadTestOptions = {
  enableTUI: boolean;
  silent?: boolean;
  outputFile?: string;
  exportFormat?: 'json' | 'markdown' | 'xlsx';
  setupSignalHandlers?: boolean;
  exportPath?: string;
  testId?: string;
};

/**
 * Worker states for lifecycle management
 */
export enum WorkerState {
  INITIALIZING = 1,
  READY = 2,
  RUNNING = 3,
  PAUSED = 4,
  FINISHED = 5,
  ERROR = 6,
  TERMINATED = 7,
}

/**
 * Endpoint states for selective stopping
 */
export enum EndpointState {
  RUNNING = 1,
  STOPPED = 2,
  ERROR = 3,
}

/**
 * Result of a load test execution.
 */
export type LoadTestResult = {
  summary: TestSummary;
  outputPath?: string;
  isCanceled: boolean;
};

/**
 * Response for a test deletion request.
 */
export type DeleteTestResponse = {
  success: boolean;
  metricsDeleted: {
    global: number;
    endpoints: number;
  };
};
