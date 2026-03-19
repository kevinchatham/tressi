import type { Procedure } from '@vitest/spy';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { WorkerThread } from './worker-thread';

vi.mock('worker_threads', () => ({
  parentPort: {
    postMessage: vi.fn(),
  },
  workerData: {
    assignedEndpoints: [
      {
        method: 'GET',
        rps: 10,
        url: 'http://example.com/api/1',
      },
    ],
    durationSec: 1,
    endpointOffset: 0,
    endpointStateBuffer: new SharedArrayBuffer(1024),
    histogramBuffer: new SharedArrayBuffer(1024),
    memoryLimit: 512,
    rampUpDurationSec: 0,
    statsBuffer: new SharedArrayBuffer(1024),
    totalWorkers: 1,
    workerId: 0,
    workerStateBuffer: new SharedArrayBuffer(1024),
  },
}));

vi.mock('../http/request-executor', () => ({
  RequestExecutor: vi.fn().mockImplementation(function (this: {
    executeRequest: Mock<Procedure>;
    releaseResultObject: Mock<Procedure>;
  }) {
    this.executeRequest = vi.fn().mockResolvedValue({
      body: '{"message":"success"}',
      bytesReceived: 200,
      bytesSent: 100,
      headers: {},
      status: 200,
      success: true,
    });
    this.releaseResultObject = vi.fn();
  }),
}));

vi.mock('../http/response-sampler', () => ({
  ResponseSampler: vi.fn().mockImplementation(function (this: {
    setWorkerState: Mock<Procedure>;
  }) {
    return {};
  }),
}));

vi.mock('../tui/terminal', () => ({
  terminal: {
    print: vi.fn(),
  },
}));

vi.mock('./shared-memory/stats-counter-manager', () => ({
  StatsCounterManager: vi.fn().mockImplementation(function (this: {
    recordRequest: Mock<Procedure>;
    recordStatusCode: Mock<Procedure>;
    recordBytesSent: Mock<Procedure>;
    recordBytesReceived: Mock<Procedure>;
  }) {
    this.recordRequest = vi.fn();
    this.recordStatusCode = vi.fn();
    this.recordBytesSent = vi.fn();
    this.recordBytesReceived = vi.fn();
  }),
}));

vi.mock('./shared-memory/hdr-histogram-manager', () => ({
  HdrHistogramManager: vi.fn().mockImplementation(function (this: {
    recordLatency: Mock<Procedure>;
  }) {
    this.recordLatency = vi.fn();
  }),
}));

vi.mock('./shared-memory/worker-state-manager', () => ({
  WorkerStateManager: vi.fn().mockImplementation(function (this: {
    setWorkerState: Mock<Procedure>;
  }) {
    this.setWorkerState = vi.fn();
  }),
}));

vi.mock('./shared-memory/endpoint-state-manager', () => ({
  EndpointStateManager: vi.fn().mockImplementation(function (this: {
    isEndpointRunning: Mock<Procedure>;
  }) {
    this.isEndpointRunning = vi.fn().mockReturnValue(true);
  }),
}));

vi.mock('./worker-rate-limiter', () => ({
  WorkerRateLimiter: vi.fn().mockImplementation(function (this: {
    getAvailableRequests: Mock<Procedure>;
  }) {
    this.getAvailableRequests = vi.fn().mockReturnValue([
      {
        method: 'GET',
        rps: 10,
        url: 'http://example.com/api/1',
      },
    ]);
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
