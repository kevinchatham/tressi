import { TressiConfig } from 'tressi-common/config';
import { EndpointMetric } from 'tressi-common/metrics';

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
  epochUpdatedAt?: number;
  /** Human-readable name for the configuration */
  name: string;
  /** Document type discriminator */
  type: 'config';
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
  /** Timestamp when the document was created (milliseconds since epoch) */
  epochCreatedAt: number;
  /** Timestamp when the test ended (milliseconds since epoch), undefined if still running */
  epochEndedAt?: number;
  /** Timestamp when the test started (milliseconds since epoch) */
  epochStartedAt?: number;
  /** Timestamp when the document was last updated (milliseconds since epoch) */
  epochUpdatedAt?: number;
  /** Error of a failed test run */
  error?: string;
  /** Current status of the test run */
  status: 'running' | 'completed' | 'failed' | 'added';
  /** Document type discriminator */
  type: 'test';
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
  /** Reference to the configuration used for this test */
  configId: string;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epoch: number;
  /** The actual metric data from the load test */
  metric: EndpointMetric;
  /** Document type discriminator */
  type: 'global-metric';
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
  /** Reference to the configuration used for this test */
  configId: string;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epoch: number;
  /** The specific endpoint URL this metric represents */
  url: string;
  /** The actual metric data from the load test */
  metric: EndpointMetric;
  /** Document type discriminator */
  type: 'endpoint-metric';
};
