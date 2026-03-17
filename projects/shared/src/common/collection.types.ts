import { TressiConfig } from './config.types';
import { TestSummary } from './reporting.types';
import { TestStatus } from './test.types';

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

export type ConfigCreate = Pick<ConfigDocument, 'name' | 'config'>;
export type ConfigEdit = Pick<ConfigDocument, 'id' | 'name' | 'config'>;

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
  status: TestStatus;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epochCreatedAt: number;
  /** Error of a failed test run */
  error: string | null;
  /** Test summary statistics - null for running tests or failed tests without summary */
  summary: TestSummary | null;
};

export type TestCreate = Pick<TestDocument, 'configId'>;
export type TestEdit = Pick<TestDocument, 'id' | 'configId'> &
  Partial<Pick<TestDocument, 'status' | 'error' | 'summary'>>;

/**
 * Metric document stored in the database.
 * Represents metrics for a specific endpoint or global metrics during a test.
 */
export type MetricDocument = {
  /** Unique identifier for the document */
  id: string;
  /** Reference to the test run this metric belongs to */
  testId: string;
  /** Timestamp when the document was created (milliseconds since epoch) */
  epoch: number;
  /** The actual metric data from the load test */
  metric: TestSummary;
};

export type MetricCreate = Pick<MetricDocument, 'testId' | 'epoch' | 'metric'>;
