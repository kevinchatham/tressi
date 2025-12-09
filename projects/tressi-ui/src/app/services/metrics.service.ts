import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { AggregatedMetrics } from 'tressi-common/metrics';

import { GetSystemMetricsResponse, RPCService } from './rpc.service';

@Injectable({
  providedIn: 'root',
})
export class SSEService {
  private readonly rpc = inject(RPCService);
  /**
   * Convenience method for metrics stream
   */
  getMetricsStream(): Observable<AggregatedMetrics> {
    const url = this.rpc.client.metrics.stream.$url();

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

  getSystemMetrics(): Observable<GetSystemMetricsResponse> {
    return from(
      this.rpc.client.metrics.system.$get().then((r: Response) => r.json()),
    );
  }
}
