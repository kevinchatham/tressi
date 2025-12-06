import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AggregatedMetrics } from 'tressi-common/metrics';

import { client } from './rpc-client';

@Injectable({
  providedIn: 'root',
})
export class SSEService {
  /**
   * Convenience method for metrics stream
   */
  getMetrics(): Observable<AggregatedMetrics> {
    const url = client.metrics.stream.$url();

    return new Observable((observer) => {
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event): void => {
        const metrics = JSON.parse(event.data) satisfies AggregatedMetrics;
        if ('duration' in metrics) observer.next(metrics);
      };

      eventSource.onerror = (error): void => {
        observer.error(error);
      };

      return () => eventSource.close();
    });
  }
}
