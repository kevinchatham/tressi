import { ISSEClientManager } from '@tressi/shared/cli';
import {
  ServerEvents,
  TestEventData,
  TestSummary,
} from '@tressi/shared/common';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEventEmitter } from '../../events/global-event-emitter';

vi.mock('../../events/global-event-emitter', () => ({
  globalEventEmitter: {
    on: vi.fn(),
  },
}));
vi.mock('./browser-routes', () => ({ default: vi.fn(() => new Hono()) }));
vi.mock('./config-routes', () => ({ default: new Hono() }));
vi.mock('./docs-routes', () => ({ default: new Hono() }));
vi.mock('./metrics-routes', () => ({ default: vi.fn(() => new Hono()) }));
vi.mock('./test-routes', () => ({ default: new Hono() }));

import { createApp } from './index';

describe('createApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a Hono app and register event listeners', () => {
    const mockSseManager = {
      broadcast: vi.fn(),
    } as unknown as ISSEClientManager;
    const port = 3000;

    createApp(mockSseManager, port);

    expect(globalEventEmitter.on).toHaveBeenCalledWith(
      ServerEvents.METRICS,
      expect.any(Function),
    );
    expect(globalEventEmitter.on).toHaveBeenCalledWith(
      ServerEvents.TEST.STARTED,
      expect.any(Function),
    );
    expect(globalEventEmitter.on).toHaveBeenCalledWith(
      ServerEvents.TEST.COMPLETED,
      expect.any(Function),
    );
    expect(globalEventEmitter.on).toHaveBeenCalledWith(
      ServerEvents.TEST.FAILED,
      expect.any(Function),
    );
    expect(globalEventEmitter.on).toHaveBeenCalledWith(
      ServerEvents.TEST.CANCELLED,
      expect.any(Function),
    );
  });

  it('should broadcast metrics event', () => {
    const mockSseManager = {
      broadcast: vi.fn(),
    } as unknown as ISSEClientManager;
    const port = 3000;

    createApp(mockSseManager, port);

    const calls = vi.mocked(globalEventEmitter.on).mock.calls;
    const metricsCall = calls.find((call) => call[0] === ServerEvents.METRICS);
    const metricsHandler = metricsCall?.[1] as (data: {
      testId?: string;
      testSummary: TestSummary;
    }) => void;

    const testSummary = { testSummary: {} as TestSummary };
    metricsHandler(testSummary);

    expect(mockSseManager.broadcast).toHaveBeenCalledWith({
      event: ServerEvents.METRICS,
      data: testSummary,
    });
  });

  it('should broadcast test started event', () => {
    const mockSseManager = {
      broadcast: vi.fn(),
    } as unknown as ISSEClientManager;
    const port = 3000;

    createApp(mockSseManager, port);

    const calls = vi.mocked(globalEventEmitter.on).mock.calls;
    const testStartedCall = calls.find(
      (call) => call[0] === ServerEvents.TEST.STARTED,
    );
    const testStartedHandler = testStartedCall?.[1] as (
      data: TestEventData,
    ) => void;

    const testData: TestEventData = {
      testId: '1',
      timestamp: Date.now(),
      status: 'running',
    };
    testStartedHandler(testData);

    expect(mockSseManager.broadcast).toHaveBeenCalledWith({
      event: ServerEvents.TEST.STARTED,
      data: testData,
    });
  });
});
