import { TressiConfig } from 'tressi-common/config';
import { EndpointMetric } from 'tressi-common/metrics';

import { ConfigRequestOutputType } from '../../server/routes/configs';

export type ConfigDatabase = {
  configs: ConfigRequestOutputType[];
};

// * For Future SignalDB Implementation

/**
 * Base document structure for all documents in the SignalDB collection.
 * Provides common fields for identification and timestamp tracking.
 */
type BaseDocument = {
  /** Unique identifier for the document */
  id: string;
  /** Timestamp when the document was created (milliseconds since epoch) */
  createdAt: number;
  /** Timestamp when the document was last updated (milliseconds since epoch) */
  updatedAt?: number;
};

/**
 * Base structure for metric documents that share common fields.
 */
type MetricBaseDocument = {
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
};

/**
 * Configuration document stored in the database.
 * Represents a saved Tressi configuration that can be reused for tests.
 */
export type ConfigDocument = BaseDocument & {
  /** Document type discriminator */
  type: 'config';
  /** Human-readable name for the configuration */
  name: string;
  /** The actual Tressi configuration data */
  config: TressiConfig;
};

/**
 * Test run document stored in the database.
 * Tracks the lifecycle of a load test execution.
 */
export type TestDocument = BaseDocument & {
  /** Document type discriminator */
  type: 'test';
  /** Reference to the configuration used for this test */
  configId: string;
  /** Timestamp when the test started (milliseconds since epoch) */
  startedAt: number;
  /** Timestamp when the test ended (milliseconds since epoch), undefined if still running */
  endedAt?: number;
  /** Current status of the test run */
  status: 'running' | 'completed' | 'failed';
  /** Error of a failed test run */
  error?: string;
};

/**
 * Global metric document stored in the database.
 * Represents aggregated metrics across all endpoints for a test.
 */
export type GlobalMetricDocument = MetricBaseDocument & {
  /** Document type discriminator */
  type: 'global-metric';
};

/**
 * Endpoint-specific metric document stored in the database.
 * Represents metrics for a specific endpoint during a test.
 */
export type EndpointMetricDocument = MetricBaseDocument & {
  /** Document type discriminator */
  type: 'endpoint-metric';
  /** The specific endpoint URL this metric represents */
  url: string;
};

/**
 * Union type representing all possible document types in the SignalDB collection.
 * Used for type-safe operations across the unified database.
 */
export type TressiDocument =
  | ConfigDocument
  | EndpointMetricDocument
  | GlobalMetricDocument
  | TestDocument;
