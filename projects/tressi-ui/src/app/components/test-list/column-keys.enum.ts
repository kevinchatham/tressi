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
  AVG_LATENCY = 'avgLatency',
  P95_LATENCY = 'p95Latency',
  P99_LATENCY = 'p99Latency',
  ACTUAL_RPS = 'actualRps',
  ACHIEVED_PERCENTAGE = 'achievedPercentage',
  TRESSI_VERSION = 'tressiVersion',
  MIN_LATENCY = 'minLatency',
  MAX_LATENCY = 'maxLatency',
  THEORETICAL_MAX_RPS = 'theoreticalMaxRps',
}

export type FieldPath =
  | 'select'
  | 'test.status'
  | 'test.epochStartedAt'
  | 'test.duration'
  | 'summary.global.totalRequests'
  | 'summary.global.errorPercentage'
  | 'summary.global.successfulRequests'
  | 'summary.global.failedRequests'
  | 'summary.global.averageLatency'
  | 'summary.global.p95Latency'
  | 'summary.global.p99Latency'
  | 'summary.tressiVersion'
  | 'summary.global.minLatency'
  | 'summary.global.maxLatency'
  | 'summary.global.epochStartedAt'
  | 'summary.global.epochEndedAt';
