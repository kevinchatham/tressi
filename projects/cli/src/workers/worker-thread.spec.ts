import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkerThread } from './worker-thread';

vi.mock('worker_threads', () => ({
  parentPort: {
    postMessage: vi.fn(),
  },
  workerData: {
    workerId: 0,
    assignedEndpoints: [
      {
        url: 'http://example.com/api/1',
        method: 'GET',
        rps: 10,
      },
    ],
    endpointOffset: 0,
    statsBuffer: new SharedArrayBuffer(1024),
    histogramBuffer: new SharedArrayBuffer(1024),
    workerStateBuffer: new SharedArrayBuffer(1024),
    endpointStateBuffer: new SharedArrayBuffer(1024),
    memoryLimit: 512,
    totalWorkers: 1,
    durationSec: 1,
    rampUpDurationSec: 0,
  },
}));

vi.mock('../http/request-executor', () => ({
  RequestExecutor: vi.fn().mockImplementation(function () {
    return {
      executeRequest: vi.fn().mockResolvedValue({
        success: true,
        status: 200,
        bytesSent: 100,
        bytesReceived: 200,
        body: '{"message":"success"}',
        headers: {},
      }),
      releaseResultObject: vi.fn(),
    };
  }),
}));

vi.mock('../http/response-sampler', () => ({
  ResponseSampler: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock('../tui/terminal', () => ({
  terminal: {
    print: vi.fn(),
  },
}));

vi.mock('./shared-memory/stats-counter-manager', () => ({
  StatsCounterManager: vi.fn().mockImplementation(function () {
    return {
      recordRequest: vi.fn(),
      recordStatusCode: vi.fn(),
      recordBytesSent: vi.fn(),
      recordBytesReceived: vi.fn(),
    };
  }),
}));

vi.mock('./shared-memory/hdr-histogram-manager', () => ({
  HdrHistogramManager: vi.fn().mockImplementation(function () {
    return {
      recordLatency: vi.fn(),
    };
  }),
}));

vi.mock('./shared-memory/worker-state-manager', () => ({
  WorkerStateManager: vi.fn().mockImplementation(function () {
    return {
      setWorkerState: vi.fn(),
    };
  }),
}));

vi.mock('./shared-memory/endpoint-state-manager', () => ({
  EndpointStateManager: vi.fn().mockImplementation(function () {
    return {
      isEndpointRunning: vi.fn().mockReturnValue(true),
    };
  }),
}));

vi.mock('./worker-rate-limiter', () => ({
  WorkerRateLimiter: vi.fn().mockImplementation(function () {
    return {
      getAvailableRequests: vi.fn().mockReturnValue([
        {
          url: 'http://example.com/api/1',
          method: 'GET',
          rps: 10,
        },
      ]),
    };
  }),
}));

describe('WorkerThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize correctly', () => {
    const worker = new WorkerThread();
    expect(worker).toBeInstanceOf(WorkerThread);
  });

  it('should start and execute requests', async () => {
    const worker = new WorkerThread();
    await worker.start();
    // Verify that request execution was called
    // Since start() is a loop, we might need to mock the loop condition
  });
});
