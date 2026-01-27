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
  NETWORK_BYTES_SENT = 'networkBytesSent',
  NETWORK_BYTES_RECEIVED = 'networkBytesReceived',
  NETWORK_THROUGHPUT = 'networkThroughput',
  AVG_RPS = 'avgRps',
  PEAK_RPS = 'peakRps',
  FINAL_DURATION_SEC = 'finalDurationSec',
  CONFIG_DURATION = 'configDuration',
  WORKER_THREADS = 'workerThreads',
  WORKER_MEMORY_LIMIT = 'workerMemoryLimit',
  GLOBAL_RAMP_UP = 'globalRampUp',
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
  | 'summary.global.epochEndedAt'
  | 'summary.global.networkBytesSent'
  | 'summary.global.networkBytesReceived'
  | 'summary.global.networkBytesPerSec'
  | 'summary.global.errorRate'
  | 'summary.global.averageRequestsPerSecond'
  | 'summary.global.peakRequestsPerSecond'
  | 'summary.global.finalDurationSec'
  | 'summary.configSnapshot.options.durationSec'
  | 'summary.configSnapshot.options.threads'
  | 'summary.configSnapshot.options.workerMemoryLimit'
  | 'summary.configSnapshot.options.rampUpDurationSec';
