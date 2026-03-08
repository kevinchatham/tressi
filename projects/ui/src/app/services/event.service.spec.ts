import { TestBed } from '@angular/core/testing';
import { ServerEvents } from '@tressi/shared/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventService } from './event.service';

describe('EventService', () => {
  let service: EventService;
  let mockEventSource: {
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: { data: string }) => void) | null;
    onerror: ((error: Error) => void) | null;
  };

  beforeEach(() => {
    mockEventSource = {
      close: vi.fn(),
      onmessage: null,
      onerror: null,
    };

    // Use a class for the mock constructor
    function MockEventSource(): unknown {
      return mockEventSource;
    }
    vi.stubGlobal('EventSource', vi.fn().mockImplementation(MockEventSource));

    TestBed.configureTestingModule({
      providers: [EventService],
    });

    service = TestBed.inject(EventService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should connect to event stream when requested', () => {
    service.connectToEventStream();
    expect(vi.mocked(EventSource)).toHaveBeenCalledWith('/api/metrics/stream');
  });

  it('should disconnect from event stream', () => {
    service.connectToEventStream();
    service.disconnectFromEventStream();
    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('should handle metrics events', () => {
    return new Promise<void>((resolve) => {
      service.getMetricsStream().subscribe((data) => {
        expect(data).toEqual({ testId: '123' });
        resolve();
      });

      service.connectToEventStream();

      const event = {
        data: JSON.stringify({
          event: ServerEvents.METRICS,
          data: { testId: '123' },
        }),
      };
      mockEventSource.onmessage?.(event);
    });
  });

  it('should handle test events', () => {
    return new Promise<void>((resolve) => {
      service.getTestEventsStream().subscribe((data) => {
        expect(data).toEqual({ status: 'started' });
        resolve();
      });

      service.connectToEventStream();

      const event = {
        data: JSON.stringify({
          event: ServerEvents.TEST.STARTED,
          data: { status: 'started' },
        }),
      };
      mockEventSource.onmessage?.(event);
    });
  });

  it('should handle connected events', () => {
    return new Promise<void>((resolve) => {
      service.getConnectedStream().subscribe((data) => {
        expect(data).toEqual({ timestamp: 12345 });
        resolve();
      });

      service.connectToEventStream();

      const event = {
        data: JSON.stringify({
          event: ServerEvents.CONNECTED,
          data: { timestamp: 12345 },
        }),
      };
      mockEventSource.onmessage?.(event);
    });
  });

  it('should handle errors', () => {
    return new Promise<void>((resolve) => {
      service.getErrorStream().subscribe((error) => {
        expect(error).toBeDefined();
        resolve();
      });

      service.connectToEventStream();
      mockEventSource.onerror?.(new Error('SSE Error'));
    });
  });

  it('should automatically connect when stream is requested', () => {
    service.getMetricsStream();
    expect(vi.mocked(EventSource)).toHaveBeenCalled();
  });
});
