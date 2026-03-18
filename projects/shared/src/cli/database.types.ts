import type { Generated, Selectable } from 'kysely';

import { TestStatus } from '../common/test.types';

export type Database = {
  configs: ConfigsTable;
  tests: TestsTable;
  metrics: MetricsTable;
  migrations: MigrationsTable;
};

export type MigrationsTable = {
  version: string;
  applied_at: number;
};

export type ConfigsTable = {
  id: Generated<string>;
  name: string;
  config: string; // JSON string of TressiConfig
  epoch_created_at: number;
  epoch_updated_at: number | null;
};

export type TestsTable = {
  id: Generated<string>;
  config_id: string;
  status: TestStatus;
  epoch_created_at: number;
  error: string | null;
  summary: string | null; // JSON string of TestSummary representing the final aggregation.
};

export type MetricsTable = {
  id: Generated<string>;
  test_id: string;
  epoch: number;
  metric: string; // JSON string of TestSummary representing a single point in time.
};

export type MigrationRow = Selectable<MigrationsTable>;
export type ConfigRow = Selectable<ConfigsTable>;
export type TestRow = Selectable<TestsTable>;
export type MetricRow = Selectable<MetricsTable>;
