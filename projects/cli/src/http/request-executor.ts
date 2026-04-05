import { performance } from 'node:perf_hooks';
import type { RequestResult, TressiRequestConfig } from '@tressi/shared/common';
import { request } from 'undici';

import { globalAgentManager } from './agent-manager';
import type { ResponseSampler } from './response-sampler';

/**
 * Executes HTTP requests and handles the complete request lifecycle.
 * This class manages HTTP request execution, response processing, and error handling.
 */
export class RequestExecutor {
  private readonly _headersPool: Record<string, string>[];
  private readonly _resultPool: RequestResult[];
  private readonly _maxPoolSize: number;
  private readonly _responseSampler: ResponseSampler;

  constructor(responseSampler: ResponseSampler, maxPoolSize: number = 1000) {
    this._responseSampler = responseSampler;
    this._headersPool = [];
    this._resultPool = [];
    this._maxPoolSize = maxPoolSize;
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
    const headers = this._getHeadersObject();
    const result = this._getResultObject();

    try {
      Object.assign(headers, globalHeaders, req.headers);
      const requestBody = this._hasValidPayload(req.payload, req.method)
        ? JSON.stringify(req.payload)
        : undefined;
      const bytesSent = requestBody ? Buffer.byteLength(requestBody, 'utf8') : 0;
      const dispatcher =
        process.env.NODE_ENV !== 'test' ? globalAgentManager.getAgent(req.url) : undefined;

      const {
        statusCode,
        body: responseBody,
        headers: responseHeaders,
      } = await request(req.url, {
        body: requestBody,
        dispatcher,
        headers,
        method: req.method || 'GET',
      });

      const method = req.method || 'GET';
      const latencyMs = Math.max(0, performance.now() - start);
      const { body, responseBodySize } = await this._handleResponseBody(
        responseBody,
        method,
        req.url,
        statusCode,
        responseHeaders,
      );

      result.method = method;
      result.url = req.url;
      result.status = statusCode;
      result.latencyMs = latencyMs;
      result.success = statusCode >= 200 && statusCode < 300;
      result.body = body;
      result.headers = responseHeaders;
      result.timestamp = performance.now();
      result.bytesSent = bytesSent;
      result.bytesReceived = responseBodySize;

      return result;
    } catch (err) {
      const latencyMs = Math.max(0, performance.now() - start);
      const requestBody = req.payload === undefined ? undefined : JSON.stringify(req.payload);
      const bytesSent = requestBody ? Buffer.byteLength(requestBody, 'utf8') : 0;

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
      this._releaseHeadersObject(headers);
    }
  }

  private async _handleResponseBody(
    responseBody: { text(): Promise<string> } | null | undefined,
    method: string,
    url: string,
    statusCode: number,
    responseHeaders: Record<string, string | string[] | undefined>,
  ): Promise<{ body: string | undefined; responseBodySize: number }> {
    let responseBodySize = 0;
    let body: string | undefined;

    if (!responseBody) {
      const contentLength = responseHeaders['content-length'];
      if (contentLength) {
        const contentLengthValue = Array.isArray(contentLength) ? contentLength[0] : contentLength;
        responseBodySize = Number.parseInt(contentLengthValue, 10) || 0;
      }
      return { body: undefined, responseBodySize };
    }

    const shouldSampleBody = this._responseSampler.shouldSampleResponse(method, url, statusCode);
    if (!shouldSampleBody) {
      const contentLength = responseHeaders['content-length'];
      if (contentLength) {
        const contentLengthValue = Array.isArray(contentLength) ? contentLength[0] : contentLength;
        responseBodySize = Number.parseInt(contentLengthValue, 10) || 0;
      }
      return { body: undefined, responseBodySize };
    }

    try {
      body = await responseBody.text();
      responseBodySize = Buffer.byteLength(body, 'utf8');
    } catch (e) {
      body = `(Could not read body: ${(e as Error).message}`;
      responseBodySize = Buffer.byteLength(body, 'utf8');
    }

    return { body, responseBodySize };
  }

  /**
   * Gets a reusable headers object from the pool or creates a new one
   */
  private _getHeadersObject(): Record<string, string> {
    return this._headersPool.pop() || {};
  }

  /**
   * Returns a headers object to the pool for reuse
   */
  private _releaseHeadersObject(headers: Record<string, string>): void {
    if (this._headersPool.length < this._maxPoolSize) {
      // Clear the object for reuse
      for (const key in headers) {
        delete headers[key];
      }
      this._headersPool.push(headers);
    }
  }

  /**
   * Gets a RequestResult object from the pool or creates a new one
   */
  private _getResultObject(): RequestResult {
    return this._resultPool.pop() || ({} as RequestResult);
  }

  /**
   * Returns a RequestResult object to the pool for reuse
   */
  releaseResultObject(result: RequestResult): void {
    if (this._resultPool.length < this._maxPoolSize) {
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
      this._resultPool.push(result);
    }
  }

  /**
   * Checks if the payload is valid and should be included in the request
   */
  private _hasValidPayload(payload: unknown, method?: string): boolean {
    // Only include body for methods that support it
    const bodyMethods = ['POST', 'PUT', 'PATCH'];
    if (!method || !bodyMethods.includes(method.toUpperCase())) {
      return false;
    }

    if (payload === null || payload === undefined) {
      return false;
    }

    // Check if payload is JSON serializable
    try {
      JSON.stringify(payload);
    } catch {
      return false;
    }

    if (Array.isArray(payload)) {
      return payload.length > 0;
    }

    if (typeof payload === 'object') {
      return Object.keys(payload).length > 0;
    }

    if (typeof payload === 'string') {
      return payload.trim().length > 0;
    }

    // For other primitive types (number, boolean, etc.)
    return true;
  }
}
