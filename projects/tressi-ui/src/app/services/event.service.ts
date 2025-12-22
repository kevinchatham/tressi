import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AggregatedMetric } from 'tressi-common/metrics';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  private readonly url = 'http://localhost:3108/api/metrics/stream';
  private eventSource: EventSource | null = null;

  private readonly metricsSubject = new Subject<AggregatedMetric>();
  private readonly testEventsSubject = new Subject<TestEventData>();
  private readonly connectedSubject = new Subject<ConnectedEventData>();

  /**
   * Get metrics stream with unified event format
   */
  getMetricsStream(): Observable<AggregatedMetric> {
    this.ensureConnected();
    return this.metricsSubject.asObservable();
  }

  /**
   * Get test events stream with unified event format
   */
  getTestEventsStream(): Observable<TestEventData> {
    this.ensureConnected();
    return this.testEventsSubject.asObservable();
  }

  /**
   * Get connected events stream with unified event format
   */
  getConnectedStream(): Observable<ConnectedEventData> {
    this.ensureConnected();
    return this.connectedSubject.asObservable();
  }

  /**
   * Ensure the event stream is connected
   * @private
   */
  private ensureConnected(): void {
    if (!this.eventSource) {
      this.connectToEventStream();
    }
  }

  /**
   * Connect to the unified event stream
   */
  connectToEventStream(): void {
    if (this.eventSource) {
      this.disconnectFromEventStream();
    }

    this.eventSource = new EventSource(this.url);

    this.eventSource.onmessage = (event): void => {
      try {
        const message = JSON.parse(event.data);

        switch (message.event) {
          case 'metrics':
            this.metricsSubject.next(message.data as AggregatedMetric);
            break;
          case 'test:started':
          case 'test:completed':
          case 'test:failed':
            this.testEventsSubject.next(message.data as TestEventData);
            break;
          case 'connected':
            this.connectedSubject.next(message.data as ConnectedEventData);
            break;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse event message:', error);
      }
    };

    this.eventSource.onerror = (error): void => {
      // eslint-disable-next-line no-console
      console.error('EventSource error:', error);
    };
  }

  /**
   * Disconnect from the event stream
   */
  disconnectFromEventStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Define UI-compatible event types
export interface TestEventData {
  testId: string;
  timestamp: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  configId?: string;
}

export interface ConnectedEventData {
  timestamp: number;
}
