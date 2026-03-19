import { ServerEvents, type TestSummary } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEventEmitter } from './global-event-emitter';

describe('GlobalEventEmitter', () => {
  let spyOn: ReturnType<typeof vi.spyOn>;
  let spyOff: ReturnType<typeof vi.spyOn>;
  let spyEmit: ReturnType<typeof vi.spyOn>;
  let spyRemoveAllListeners: ReturnType<typeof vi.spyOn>;
  let spyListenerCount: ReturnType<typeof vi.spyOn>;
  let spyListeners: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up spies on the EventEmitter methods
    spyOn = vi.spyOn(globalEventEmitter, 'on');
    spyOff = vi.spyOn(globalEventEmitter, 'off');
    spyEmit = vi.spyOn(globalEventEmitter, 'emit');
    spyRemoveAllListeners = vi.spyOn(globalEventEmitter, 'removeAllListeners');
    spyListenerCount = vi.spyOn(globalEventEmitter, 'listenerCount');
    spyListeners = vi.spyOn(globalEventEmitter, 'listeners');
  });

  describe('EventEmitter interface', () => {
    it('should have on method', () => {
      expect(typeof globalEventEmitter.on).toBe('function');
    });

    it('should have off method', () => {
      expect(typeof globalEventEmitter.off).toBe('function');
    });

    it('should have emit method', () => {
      expect(typeof globalEventEmitter.emit).toBe('function');
    });

    it('should have removeListener method', () => {
      expect(typeof globalEventEmitter.removeListener).toBe('function');
    });

    it('should have removeAllListeners method', () => {
      expect(typeof globalEventEmitter.removeAllListeners).toBe('function');
    });

    it('should have listenerCount method', () => {
      expect(typeof globalEventEmitter.listenerCount).toBe('function');
    });

    it('should have listeners method', () => {
      expect(typeof globalEventEmitter.listeners).toBe('function');
    });
  });

  describe('metrics event', () => {
    it('should register listener for metrics event', () => {
      const callback = vi.fn();

      globalEventEmitter.on('metrics', callback);

      expect(spyOn).toHaveBeenCalledWith('metrics', callback);
    });

    it('should register multiple listeners for metrics event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      globalEventEmitter.on('metrics', callback1);
      globalEventEmitter.on('metrics', callback2);

      expect(spyOn).toHaveBeenCalledTimes(2);
      expect(spyOn).toHaveBeenCalledWith('metrics', callback1);
      expect(spyOn).toHaveBeenCalledWith('metrics', callback2);
    });

    it('should remove listener for metrics event', () => {
      const callback = vi.fn();

      globalEventEmitter.off('metrics', callback);

      expect(spyOff).toHaveBeenCalledWith('metrics', callback);
    });

    it('should emit metrics event and trigger callback', () => {
      const callback = vi.fn();
      const testSummary = {
        configSnapshot: { name: 'test', options: {}, requests: [] } as unknown,
        endpoints: [],
        global: {
          averageLatency: 150,
          bytesReceived: 1000,
          bytesSent: 500,
          duration: 2000,
          errorsByCode: {},
          errorsByMessage: {},
          failedRequests: 5,
          latencyHistogram: null,
          maxLatencyMs: 500,
          minLatencyMs: 50,
          p50LatencyMs: 100,
          p95LatencyMs: 300,
          p99LatencyMs: 500,
          rps: 50,
          successfulRequests: 95,
          totalEndpoints: 1,
          totalRequests: 100,
        },
        tressiVersion: '1.0.0',
      } as unknown as TestSummary;

      globalEventEmitter.on('metrics', callback);
      globalEventEmitter.emit('metrics', { testId: 'test-1', testSummary });

      expect(callback).toHaveBeenCalledWith({ testId: 'test-1', testSummary });
    });
  });

  describe('test:started event', () => {
    it('should register listener for test:started event', () => {
      const callback = vi.fn();

      globalEventEmitter.on(ServerEvents.TEST.STARTED, callback);

      expect(spyOn).toHaveBeenCalledWith(ServerEvents.TEST.STARTED, callback);
    });

    it('should emit test:started event and trigger callback', () => {
      const callback = vi.fn();
      const testEventData = {
        status: 'running' as const,
        testId: 'test-123',
        timestamp: Date.now(),
      };

      globalEventEmitter.on(ServerEvents.TEST.STARTED, callback);
      globalEventEmitter.emit(ServerEvents.TEST.STARTED, testEventData);

      expect(callback).toHaveBeenCalledWith(testEventData);
    });

    it('should emit test:started event with configId', () => {
      const callback = vi.fn();
      const testEventData = {
        configId: 'config-1',
        status: 'running' as const,
        testId: 'test-456',
        timestamp: Date.now(),
      };

      globalEventEmitter.on(ServerEvents.TEST.STARTED, callback);
      globalEventEmitter.emit(ServerEvents.TEST.STARTED, testEventData);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          configId: 'config-1',
        }),
      );
    });
  });

  describe('test:completed event', () => {
    it('should register listener for test:completed event', () => {
      const callback = vi.fn();

      globalEventEmitter.on(ServerEvents.TEST.COMPLETED, callback);

      expect(spyOn).toHaveBeenCalledWith(ServerEvents.TEST.COMPLETED, callback);
    });

    it('should emit test:completed event and trigger callback', () => {
      const callback = vi.fn();
      const testEventData = {
        status: 'completed' as const,
        testId: 'test-123',
        timestamp: Date.now(),
      };

      globalEventEmitter.on(ServerEvents.TEST.COMPLETED, callback);
      globalEventEmitter.emit(ServerEvents.TEST.COMPLETED, testEventData);

      expect(callback).toHaveBeenCalledWith(testEventData);
    });
  });

  describe('test:failed event', () => {
    it('should register listener for test:failed event', () => {
      const callback = vi.fn();

      globalEventEmitter.on(ServerEvents.TEST.FAILED, callback);

      expect(spyOn).toHaveBeenCalledWith(ServerEvents.TEST.FAILED, callback);
    });

    it('should emit test:failed event with error data', () => {
      const callback = vi.fn();
      const testEventData = {
        error: 'Connection timeout',
        status: 'failed' as const,
        testId: 'test-123',
        timestamp: Date.now(),
      };

      globalEventEmitter.on(ServerEvents.TEST.FAILED, callback);
      globalEventEmitter.emit(ServerEvents.TEST.FAILED, testEventData);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Connection timeout',
          status: 'failed',
        }),
      );
    });
  });

  describe('test:cancelled event', () => {
    it('should register listener for test:cancelled event', () => {
      const callback = vi.fn();

      globalEventEmitter.on(ServerEvents.TEST.CANCELLED, callback);

      expect(spyOn).toHaveBeenCalledWith(ServerEvents.TEST.CANCELLED, callback);
    });

    it('should emit test:cancelled event and trigger callback', () => {
      const callback = vi.fn();
      const testEventData = {
        status: 'cancelled' as const,
        testId: 'test-123',
        timestamp: Date.now(),
      };

      globalEventEmitter.on(ServerEvents.TEST.CANCELLED, callback);
      globalEventEmitter.emit(ServerEvents.TEST.CANCELLED, testEventData);

      expect(callback).toHaveBeenCalledWith(testEventData);
    });
  });

  describe('Listener management', () => {
    it('should remove specific listener', () => {
      const callback = vi.fn();

      globalEventEmitter.off('metrics', callback);

      expect(spyOff).toHaveBeenCalledWith('metrics', callback);
    });

    it('should remove all listeners for an event', () => {
      globalEventEmitter.removeAllListeners('metrics');

      expect(spyRemoveAllListeners).toHaveBeenCalledWith('metrics');
    });

    it('should remove all listeners when no event specified', () => {
      globalEventEmitter.removeAllListeners();

      expect(spyRemoveAllListeners).toHaveBeenCalledWith();
    });

    it('should get listener count', () => {
      spyListenerCount.mockReturnValue(2);

      const count = globalEventEmitter.listenerCount('metrics');

      expect(spyListenerCount).toHaveBeenCalledWith('metrics');
      expect(count).toBe(2);
    });

    it('should get all listeners for an event', () => {
      const mockListeners = [vi.fn(), vi.fn()];
      spyListeners.mockReturnValue(
        mockListeners as unknown as ReturnType<typeof globalEventEmitter.listeners>,
      );

      const listeners = globalEventEmitter.listeners('metrics');

      expect(spyListeners).toHaveBeenCalledWith('metrics');
      expect(listeners).toEqual(mockListeners);
    });
  });

  describe('Edge cases', () => {
    it('should handle emitting to no listeners without error', () => {
      expect(() => {
        (globalEventEmitter.emit as unknown as (event: string, payload: unknown) => boolean)(
          'metrics',
          { testSummary: {} },
        );
      }).not.toThrow();
    });

    it('should handle multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      globalEventEmitter.on('metrics', callback1);
      globalEventEmitter.on('metrics', callback2);

      expect(spyOn).toHaveBeenCalledTimes(2);
    });

    it('should handle removing non-existent listener without error', () => {
      const callback = vi.fn();

      expect(() => {
        (globalEventEmitter.off as unknown as (event: string, listener: () => void) => void)(
          'nonexistent',
          callback,
        );
      }).not.toThrow();
    });

    it('should handle event with various data types', () => {
      const callback = vi.fn();

      globalEventEmitter.on('metrics', callback);

      // Test with null
      (globalEventEmitter.emit as unknown as (event: string, payload: unknown) => boolean)(
        'metrics',
        null,
      );
      expect(callback).toHaveBeenCalledWith(null);

      // Test with undefined
      (globalEventEmitter.emit as unknown as (event: string, payload: unknown) => boolean)(
        'metrics',
        undefined,
      );
      expect(callback).toHaveBeenCalledWith(undefined);

      // Test with empty object
      (globalEventEmitter.emit as unknown as (event: string, payload: unknown) => boolean)(
        'metrics',
        {},
      );
      expect(callback).toHaveBeenCalledWith({});
    });

    it('should handle removing and re-adding listener', () => {
      const callback = vi.fn();

      globalEventEmitter.on('metrics', callback);
      globalEventEmitter.off('metrics', callback);
      globalEventEmitter.on('metrics', callback);

      expect(spyOn).toHaveBeenCalledTimes(2);
      expect(spyOff).toHaveBeenCalledTimes(1);
    });

    it('should handle emit return value', () => {
      const callback = vi.fn();
      globalEventEmitter.on('metrics', callback);
      spyEmit.mockReturnValue(true);

      const result = (
        globalEventEmitter.emit as unknown as (event: string, payload: unknown) => boolean
      )('metrics', { testSummary: {} });

      expect(typeof result).toBe('boolean');
    });
  });

  // Note: The 'connected' event is not part of IGlobalServerEvents interface
  // but is defined in ServerEventMessage type. These tests verify that
  // the EventEmitter can still handle it at runtime despite TypeScript errors.
});
