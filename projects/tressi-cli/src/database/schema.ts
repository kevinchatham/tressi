import type { Generated, Selectable } from 'kysely';

export type Database = {
  configs: ConfigsTable;
  tests: TestsTable;
  global_metrics: GlobalMetricsTable;
  endpoint_metrics: EndpointMetricsTable;
};

export type ConfigsTable = {
  id: Generated<string>;
  name: string;
  config: string; // JSON string of TressiConfig
  epoch_created_at: number;
  epoch_updated_at: number | null;
};

export type TestStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | null;

export type TestsTable = {
  id: Generated<string>;
  config_id: string;
  status: TestStatus;
  epoch_created_at: number;
  error: string | null;
  summary: string | null; // JSON string of TestSummary
};

export type GlobalMetricsTable = {
  id: Generated<string>;
  test_id: string;
  epoch: number;
  metric: string; // JSON string of Metric
};

export type EndpointMetricsTable = {
  id: Generated<string>;
  test_id: string;
  url: string;
  epoch: number;
  metric: string; // JSON string of Metric
};

export type ConfigRow = Selectable<ConfigsTable>;
export type TestRow = Selectable<TestsTable>;
export type GlobalMetricRow = Selectable<GlobalMetricsTable>;
export type EndpointMetricRow = Selectable<EndpointMetricsTable>;
