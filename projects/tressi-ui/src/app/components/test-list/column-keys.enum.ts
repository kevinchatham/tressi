export enum ColumnKey {
  SELECT = 'select',
  STATUS = 'status',
  START_TIME = 'startTime',
  END_TIME = 'endTime',
  ID = 'id',
  DURATION = 'duration',
  TOTAL_REQUESTS = 'totalRequests',
  ERROR_RATE = 'errorRate',
  SUCCESSFUL_REQUESTS = 'successfulRequests',
  FAILED_REQUESTS = 'failedRequests',
  p50_LATENCY = 'p50LatencyMs',
  P95_LATENCY = 'p95LatencyMs',
  P99_LATENCY = 'p99LatencyMs',
  TRESSI_VERSION = 'tressiVersion',
  MIN_LATENCY = 'minLatencyMs',
  MAX_LATENCY = 'maxLatencyMs',
}

export type FieldPath =
  | 'select'
  | 'test.status'
  | 'test.epochStartedAt'
  | 'test.duration'
  | 'summary.global.totalRequests'
  | 'summary.global.successfulRequests'
  | 'summary.global.failedRequests'
  | 'summary.global.p50LatencyMs'
  | 'summary.global.p95LatencyMs'
  | 'summary.global.p99LatencyMs'
  | 'summary.tressiVersion'
  | 'summary.global.minLatencyMs'
  | 'summary.global.maxLatencyMs'
  | 'summary.global.epochStartedAt'
  | 'summary.global.epochEndedAt';
