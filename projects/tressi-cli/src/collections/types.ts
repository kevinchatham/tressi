import { TressiConfig } from '../common/config/types';
import { Metric } from '../common/metrics';
import { TestSummary } from '../reporting/types';

/**
 * Configuration document stored in the database.
 * Represents a saved Tressi configuration that can be reused for tests.
 */
export type ConfigDocument = {
  /** Unique identifier for the document */
  id: string;
  /** The actual Tressi configuration data */
  config: TressiConfig;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epochCreatedAt: number;
  /** Timestamp when the document was last updated (milliseconds since epoch) */
  epochUpdatedAt: number | null;
  /** Human-readable name for the configuration */
  name: string;
};

/**
 * Test run document stored in the database.
 * Tracks the lifecycle of a load test execution.
 */
export type TestDocument = {
  /** Unique identifier for the document */
  id: string;
  /** Reference to the configuration used for this test */
  configId: string;
  /** Current status of the test run */
  status: 'running' | 'completed' | 'failed' | 'cancelled' | null;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epochCreatedAt: number;
  /** Error of a failed test run */
  error: string | null;
  /** Test summary statistics - null for running tests or failed tests without summary */
  summary: TestSummary | null;
};

/**
 * Global metric document stored in the database.
 * Represents aggregated metrics across all endpoints for a test.
 */
export type GlobalMetricDocument = {
  /** Unique identifier for the document */
  id: string;
  /** Reference to the test run this metric belongs to */
  testId: string;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epoch: number;
  /** The actual metric data from the load test */
  metric: Metric;
};

/**
 * Endpoint-specific metric document stored in the database.
 * Represents metrics for a specific endpoint during a test.
 */
export type EndpointMetricDocument = {
  /** Unique identifier for the document */
  id: string;
  /** Reference to the test run this metric belongs to */
  testId: string;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epoch: number;
  /** The specific endpoint URL this metric represents */
  url: string;
  /** The actual metric data from the load test */
  metric: Metric;
};
