import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, first, timeout } from 'rxjs/operators';
import {
  ErrorApiResponse,
  HealthApiResponse,
  JobStatusApiResponse,
  LoadTestApiResponse,
  serverRoutes,
  TressiServerRoute,
} from 'tressi-common/api';
import { TressiConfig } from 'tressi-common/config';
import { AggregatedMetrics } from 'tressi-common/metrics';

import { LogService } from './log.service';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LogService);

  /**
   * GET request overload - no body allowed
   * @param serverRoute - The route configuration for GET requests
   * @returns Observable of the response data
   */
  request<TResponse = unknown>(
    serverRoute: TressiServerRoute & { method: 'get' },
  ): Observable<TResponse>;
  /**
   * POST request overload - body required
   * @param serverRoute - The route configuration for POST requests
   * @param body - Request body for POST requests
   * @returns Observable of the response data
   */
  request<TRequest, TResponse>(
    serverRoute: TressiServerRoute & { method: 'post' },
    body: TRequest,
  ): Observable<TResponse>;
  /**
   * DELETE request overload - no body allowed
   * @param serverRoute - The route configuration for DELETE requests
   * @returns Observable of the response data
   */
  request<TResponse = unknown>(
    serverRoute: TressiServerRoute & { method: 'delete' },
  ): Observable<TResponse>;
  /**
   * Implementation signature for generic HTTP calls
   * @param _route - The route configuration containing method and endpoint
   * @param body - Optional request body for POST requests
   * @returns Observable of the response data
   */
  request<TRequest = unknown, TResponse = unknown>(
    _route: TressiServerRoute,
    body?: TRequest,
  ): Observable<TResponse> {
    const { method, route } = _route;
    let response$: Observable<TResponse>;

    const url = `http://localhost:3108${route}`;

    switch (method) {
      case 'get':
        response$ = this.http.get<TResponse>(url);
        break;

      case 'post':
        response$ = this.http.post<TResponse>(url, body ?? null);
        break;

      case 'delete':
        response$ = this.http.delete<TResponse>(url);
        break;

      default:
        return throwError(
          () => new Error(`Unsupported HTTP method: ${method}`),
        );
    }

    return response$.pipe(first(), timeout(5000), catchError(this.handleError));
  }

  /**
   * Convenience method for health check
   */
  getHealth(): Observable<HealthApiResponse> {
    return this.request<HealthApiResponse>(serverRoutes.health);
  }

  /**
   * Convenience method for metrics stream
   */
  getMetrics(): Observable<AggregatedMetrics> {
    const { route } = serverRoutes.metrics;
    const url = `http://localhost:3108${route}`;

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

  /**
   * Convenience method for job status
   */
  getJobStatus(): Observable<JobStatusApiResponse> {
    return this.request<JobStatusApiResponse>(serverRoutes.status);
  }

  /**
   * Convenience method for starting a load test
   */
  startLoadTest(config: TressiConfig): Observable<LoadTestApiResponse> {
    return this.request<TressiConfig, LoadTestApiResponse>(
      serverRoutes.test,
      config,
    );
  }

  /**
   * Centralized error handling
   * @param error - The HTTP error response
   * @returns Observable that errors with a user-friendly message
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage: string;

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      const serverError = error.error as ErrorApiResponse;
      errorMessage =
        serverError?.error?.message ||
        `Server error ${error.status}: ${error.statusText}`;
    }

    this.log.error(error);
    return throwError(() => new Error(errorMessage));
  }
}
