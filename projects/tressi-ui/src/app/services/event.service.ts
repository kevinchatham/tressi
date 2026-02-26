import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { TestSummary } from './rpc.service';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  private readonly _url = '/api/metrics/stream';
  private _eventSource: EventSource | null = null;

  private readonly _metricsSubject = new Subject<TestSummaryData>();
  private readonly _testEventsSubject = new Subject<TestEventData>();
  private readonly _connectedSubject = new Subject<ConnectedEventData>();
  private readonly _errorSubject = new Subject<Event>();

  /**
   * Get metrics stream with unified event format
   */
  getMetricsStream(): Observable<TestSummaryData> {
    this._ensureConnected();
    return this._metricsSubject.asObservable();
  }

  /**
   * Get test events stream with unified event format
   */
  getTestEventsStream(): Observable<TestEventData> {
    this._ensureConnected();
    return this._testEventsSubject.asObservable();
  }

  /**
   * Get connected events stream with unified event format
   */
  getConnectedStream(): Observable<ConnectedEventData> {
    this._ensureConnected();
    return this._connectedSubject.asObservable();
  }

  /**
   * Get error stream for connection issues
   */
  getErrorStream(): Observable<Event> {
    return this._errorSubject.asObservable();
  }

  /**
   * Ensure the event stream is connected
   * @private
   */
  private _ensureConnected(): void {
    if (!this._eventSource) {
      this.connectToEventStream();
    }
  }

  /**
   * Connect to the unified event stream
   */
  connectToEventStream(): void {
    if (this._eventSource) {
      this.disconnectFromEventStream();
    }

    this._eventSource = new EventSource(this._url);

    this._eventSource.onmessage = (event): void => {
      try {
        const message = JSON.parse(event.data);

        switch (message.event) {
          case 'metrics':
            this._metricsSubject.next(message.data as TestSummaryData);
            break;
          case 'test:started':
          case 'test:completed':
          case 'test:failed':
          case 'test:cancelled':
            this._testEventsSubject.next(message.data as TestEventData);
            break;
          case 'connected':
            this._connectedSubject.next(message.data as ConnectedEventData);
            break;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse event message:', error);
      }
    };

    this._eventSource.onerror = (error): void => {
      // eslint-disable-next-line no-console
      console.error('EventSource error:', error);
      this._errorSubject.next(error);
      // Close the failed connection to allow for a clean retry
      this.disconnectFromEventStream();
    };
  }

  /**
   * Disconnect from the event stream
   */
  disconnectFromEventStream(): void {
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
  }
}

// Define UI-compatible event types
export interface TestSummaryData {
  testId?: string;
  testSummary: TestSummary;
}

export interface TestEventData {
  testId: string;
  timestamp: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  configId?: string;
}

export interface ConnectedEventData {
  timestamp: number;
}
