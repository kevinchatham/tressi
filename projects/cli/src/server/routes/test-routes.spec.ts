import { ServerEvents, type TestDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configStorage } from '../../collections/config-collection';
import { metricStorage } from '../../collections/metrics-collection';
import { testStorage } from '../../collections/test-collection';
import { runLoadTestForServer, stopLoadTest } from '../../core/test-executor';
import { globalEventEmitter } from '../../events/global-event-emitter';
import app from './test-routes';

vi.mock('../../collections/test-collection', () => ({
  testStorage: {
    create: vi.fn(),
    delete: vi.fn(),
    edit: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../../collections/config-collection', () => ({
  configStorage: {
    getById: vi.fn(),
  },
}));

vi.mock('../../collections/metrics-collection', () => ({
  metricStorage: {
    deleteByTestId: vi.fn(),
  },
}));

vi.mock('../../core/test-executor', () => ({
  runLoadTestForServer: vi.fn(),
  stopLoadTest: vi.fn(),
}));

vi.mock('../../events/global-event-emitter', () => ({
  globalEventEmitter: {
    emit: vi.fn(),
  },
}));

vi.mock('../utils/error-response-generator', () => ({
  createApiErrorResponse: vi.fn((message, code) => ({ code, message })),
}));

vi.mock('../../reporting/exporters/markdown-exporter', () => ({
  MarkdownExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue('# Test Results\n\nSummary here'),
  })),
}));

vi.mock('../../reporting/exporters/xlsx-exporter', () => ({
  XlsxExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  })),
}));

describe('test-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return all tests', async () => {
      const mockTests = [{ id: '1', status: 'completed' }];
      vi.mocked(testStorage.getAll).mockResolvedValue(mockTests as unknown as TestDocument[]);

      const res = await app.request('/');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockTests);
    });

    it('should return 500 on error', async () => {
      vi.mocked(testStorage.getAll).mockRejectedValue(new Error('Database error'));

      const res = await app.request('/');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /:id', () => {
    it('should return a test', async () => {
      const mockTest = { id: '1', status: 'completed' };
      vi.mocked(testStorage.getById).mockResolvedValue(mockTest as unknown as TestDocument);

      const res = await app.request('/1');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockTest);
    });

    it('should return 404 if test not found', async () => {
      vi.mocked(testStorage.getById).mockResolvedValue(undefined);

      const res = await app.request('/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete a test', async () => {
      vi.mocked(testStorage.getById).mockResolvedValue({
        id: '1',
      } as unknown as TestDocument);
      vi.mocked(testStorage.delete).mockResolvedValue(true);
      vi.mocked(metricStorage.deleteByTestId).mockResolvedValue(1);

      const res = await app.request('/1', { method: 'DELETE' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ metricsDeleted: 1, success: true });
    });

    it('should return 404 if test not found', async () => {
      vi.mocked(testStorage.getById).mockResolvedValue(undefined);

      const res = await app.request('/nonexistent', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /status', () => {
    it('should return isRunning: false when no tests are running', async () => {
      vi.mocked(testStorage.getAll).mockResolvedValue([] as unknown as TestDocument[]);

      const res = await app.request('/status');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ isRunning: false });
    });

    it('should return isRunning: true with job info when a test is running', async () => {
      const mockRunningTest = {
        id: 'running-1',
        status: 'running',
        summary: { global: { epochStartedAt: 1000 } },
      };
      vi.mocked(testStorage.getAll).mockResolvedValue([
        mockRunningTest,
      ] as unknown as TestDocument[]);

      const res = await app.request('/status');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isRunning).toBe(true);
      expect(json.jobId).toBe('running-1');
    });
  });

  describe('POST /stop', () => {
    it('should stop the load test', async () => {
      vi.mocked(stopLoadTest).mockResolvedValue(undefined);

      const res = await app.request('/stop', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(stopLoadTest).toHaveBeenCalled();
    });

    it('should return 500 on error', async () => {
      vi.mocked(stopLoadTest).mockRejectedValue(new Error('Failed to stop'));

      const res = await app.request('/stop', { method: 'POST' });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /:id/export', () => {
    it('should export test as JSON', async () => {
      const mockTest = {
        id: '1',
        status: 'completed',
        summary: { endpoints: [], global: {} },
      };
      vi.mocked(testStorage.getById).mockResolvedValue(mockTest as unknown as TestDocument);

      const res = await app.request('/1/export?format=json');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return 404 if test not found', async () => {
      vi.mocked(testStorage.getById).mockResolvedValue(undefined);

      const res = await app.request('/nonexistent/export?format=json');
      expect(res.status).toBe(404);
    });

    it('should return 400 if no summary available', async () => {
      const mockTest = { id: '1', status: 'completed', summary: undefined };
      vi.mocked(testStorage.getById).mockResolvedValue(mockTest as unknown as TestDocument);

      const res = await app.request('/1/export?format=json');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid format', async () => {
      const mockTest = {
        id: '1',
        status: 'completed',
        summary: { endpoints: [], global: {} },
      };
      vi.mocked(testStorage.getById).mockResolvedValue(mockTest as unknown as TestDocument);

      const res = await app.request('/1/export?format=invalid');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /', () => {
    it('should reject when a test is already running', async () => {
      const mockRunningTest = { id: 'running-1', status: 'running' };
      vi.mocked(testStorage.getAll).mockResolvedValue([
        mockRunningTest,
      ] as unknown as TestDocument[]);

      const res = await app.request('/', {
        body: JSON.stringify({ configId: 'config-1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      expect(res.status).toBe(409);
    });

    it('should return 404 when config not found', async () => {
      vi.mocked(testStorage.getAll).mockResolvedValue([] as unknown as TestDocument[]);
      vi.mocked(configStorage.getById).mockResolvedValue(undefined);

      const res = await app.request('/', {
        body: JSON.stringify({ configId: 'nonexistent' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });

    it('should start a new test', async () => {
      vi.mocked(testStorage.getAll).mockResolvedValue([] as unknown as TestDocument[]);
      vi.mocked(configStorage.getById).mockResolvedValue({ id: 'config-1' } as unknown as never);
      vi.mocked(testStorage.create).mockResolvedValue({ id: 'test-1' } as unknown as never);
      vi.mocked(testStorage.edit).mockResolvedValue(undefined as never);
      vi.mocked(runLoadTestForServer).mockResolvedValue({
        isCanceled: false,
        summary: {},
      } as unknown as never);

      const res = await app.request('/', {
        body: JSON.stringify({ configId: 'config-1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.testId).toBe('test-1');
    });

    it('should set status to failed when early exit is triggered', async () => {
      vi.mocked(testStorage.getAll).mockResolvedValue([] as unknown as TestDocument[]);
      vi.mocked(configStorage.getById).mockResolvedValue({ id: 'config-1' } as unknown as never);
      vi.mocked(testStorage.create).mockResolvedValue({ id: 'test-1' } as unknown as never);
      vi.mocked(testStorage.edit).mockResolvedValue(undefined as never);
      vi.mocked(runLoadTestForServer).mockResolvedValue({
        earlyExitTriggered: true,
        isCanceled: false,
        summary: {},
      } as unknown as never);

      const res = await app.request('/', {
        body: JSON.stringify({ configId: 'config-1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      expect(res.status).toBe(202);

      await vi.waitFor(() => {
        expect(testStorage.edit).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'failed' }),
        );
        expect(globalEventEmitter.emit).toHaveBeenCalledWith(
          ServerEvents.TEST.FAILED,
          expect.any(Object),
        );
      });
    });
  });
});
