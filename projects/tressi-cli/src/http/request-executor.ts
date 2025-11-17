import { performance } from 'perf_hooks';
import type { RequestResult, TressiRequestConfig } from 'tressi-common';
import { request } from 'undici';

import { globalAgentManager } from './agent-manager';
import { ResponseSampler } from './response-sampler';

/**
 * Executes HTTP requests and handles the complete request lifecycle.
 * This class manages HTTP request execution, response processing, and error handling.
 */
export class RequestExecutor {
  private headersPool: Record<string, string>[];
  private resultPool: RequestResult[];
  private maxPoolSize: number;
  private responseSampler: ResponseSampler;

  constructor(responseSampler: ResponseSampler, maxPoolSize: number = 1000) {
    this.responseSampler = responseSampler;
    this.headersPool = [];
    this.resultPool = [];
    this.maxPoolSize = maxPoolSize;
  }

  /**
   * Executes a single HTTP request and returns the result.
   * @param req The request configuration
   * @param globalHeaders Optional global headers to merge with request headers
   * @returns Promise<RequestResult> The request result
   */
  async executeRequest(
    req: TressiRequestConfig,
    globalHeaders?: Record<string, string>,
  ): Promise<RequestResult> {
    const start = performance.now();
    const headers = this.getHeadersObject();
    const result = this.getResultObject();

    try {
      // Reuse headers object instead of creating new one
      Object.assign(headers, globalHeaders, req.headers);

      // Calculate request body size for bandwidth tracking
      const requestBody =
        req.payload === undefined ? undefined : JSON.stringify(req.payload);
      const bytesSent = requestBody
        ? Buffer.byteLength(requestBody, 'utf8')
        : 0;

      // Use per-endpoint agents in production, global dispatcher in tests
      const dispatcher =
        process.env.NODE_ENV !== 'test'
          ? globalAgentManager.getAgent(req.url)
          : undefined; // When undefined, undici will use the global dispatcher

      const {
        statusCode,
        body: responseBody,
        headers: responseHeaders,
      } = await request(req.url, {
        method: req.method || 'GET',
        headers,
        body: requestBody,
        dispatcher,
      });

      const method = req.method || 'GET';
      const latencyMs = Math.max(0, performance.now() - start);

      // Calculate response body size for bandwidth tracking
      let responseBodySize = 0;
      let body: string | undefined;

      // Check if we should sample this status code for this endpoint
      const shouldSampleBody = this.responseSampler.shouldSampleResponse(
        method,
        req.url,
        statusCode,
      );

      // Handle response body sampling
      if (responseBody && shouldSampleBody) {
        try {
          body = await responseBody.text();
          responseBodySize = Buffer.byteLength(body, 'utf8');
        } catch (e) {
          // Ignore body read errors, it might be empty.
          body = `(Could not read body: ${(e as Error).message}`;
          responseBodySize = Buffer.byteLength(body, 'utf8');
        }
      }

      // Calculate total bytes received from headers if available
      const contentLength = responseHeaders['content-length'];
      if (contentLength && !responseBodySize) {
        const contentLengthValue = Array.isArray(contentLength)
          ? contentLength[0]
          : contentLength;
        responseBodySize = parseInt(contentLengthValue, 10) || 0;
      }

      // Populate result object from pool
      result.method = method;
      result.url = req.url;
      result.status = statusCode;
      result.latencyMs = latencyMs;
      result.success = statusCode >= 200 && statusCode < 300;
      result.body = body;
      result.timestamp = performance.now();
      result.bytesSent = bytesSent;
      result.bytesReceived = responseBodySize;

      return result;
    } catch (err) {
      const latencyMs = Math.max(0, performance.now() - start);

      // Calculate request body size for bandwidth tracking (even in error case)
      const requestBody =
        req.payload === undefined ? undefined : JSON.stringify(req.payload);
      const bytesSent = requestBody
        ? Buffer.byteLength(requestBody, 'utf8')
        : 0;

      // Populate result object for error case
      result.method = req.method || 'GET';
      result.url = req.url;
      result.status = 0;
      result.latencyMs = latencyMs;
      result.success = false;
      result.error = (err as Error).message;
      result.timestamp = performance.now();
      result.bytesSent = bytesSent;
      result.bytesReceived = 0;

      return result;
    } finally {
      // Always release headers object back to pool
      this.releaseHeadersObject(headers);
      // Note: result object is released by caller after it's processed
    }
  }

  /**
   * Processes response body for sampling.
   * @param responseBody The response body stream
   * @returns Promise<string | undefined> The sampled body text or undefined
   */

  /**
   * Gets a reusable headers object from the pool or creates a new one
   */
  private getHeadersObject(): Record<string, string> {
    return this.headersPool.pop() || {};
  }

  /**
   * Returns a headers object to the pool for reuse
   */
  private releaseHeadersObject(headers: Record<string, string>): void {
    if (this.headersPool.length < this.maxPoolSize) {
      // Clear the object for reuse
      for (const key in headers) {
        delete headers[key];
      }
      this.headersPool.push(headers);
    }
  }

  /**
   * Gets a RequestResult object from the pool or creates a new one
   */
  private getResultObject(): RequestResult {
    return this.resultPool.pop() || ({} as RequestResult);
  }

  /**
   * Returns a RequestResult object to the pool for reuse
   */
  releaseResultObject(result: RequestResult): void {
    if (this.resultPool.length < this.maxPoolSize) {
      // Clear the object for reuse
      result.method = '';
      result.url = '';
      result.status = 0;
      result.latencyMs = 0;
      result.success = false;
      result.body = undefined;
      result.error = undefined;
      result.timestamp = 0;
      result.bytesSent = 0;
      result.bytesReceived = 0;
      this.resultPool.push(result);
    }
  }

  /**
   * Clears all object pools
   */
  clearPools(): void {
    this.headersPool.length = 0;
    this.resultPool.length = 0;
  }
}
