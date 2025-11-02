import type { RequestResult } from '../types';

/**
 * Processes HTTP responses and extracts relevant information.
 * This class handles response body sampling, error processing, and result formatting.
 */
export class ResponseProcessor {
  private responseSampler?: ResponseSampler;

  constructor(responseSampler?: ResponseSampler) {
    this.responseSampler = responseSampler;
  }

  /**
   * Processes a successful HTTP response.
   * @param statusCode The HTTP status code
   * @param responseBody The response body (optional)
   * @param method The HTTP method
   * @param url The request URL
   * @param latencyMs The request latency in milliseconds
   * @returns The processed RequestResult
   */
  processSuccessResponse(
    statusCode: number,
    responseBody: { text(): Promise<string> } | undefined,
    method: string,
    url: string,
    latencyMs: number,
  ): RequestResult {
    const result: RequestResult = {
      method,
      url,
      status: statusCode,
      latencyMs,
      success: statusCode >= 200 && statusCode < 300,
      timestamp: performance.now(),
    };

    // Handle response body sampling if responseSampler is provided
    if (this.responseSampler && responseBody) {
      if (this.responseSampler.shouldSampleResponse(method, url, statusCode)) {
        this.processResponseBody(responseBody, result);
      }
    }

    return result;
  }

  /**
   * Processes a failed HTTP response or network error.
   * @param error The error that occurred
   * @param method The HTTP method
   * @param url The request URL
   * @param latencyMs The request latency in milliseconds (if available)
   * @returns The processed RequestResult
   */
  processErrorResponse(
    error: Error,
    method: string,
    url: string,
    latencyMs: number,
  ): RequestResult {
    return {
      method,
      url,
      status: 0,
      latencyMs,
      success: false,
      error: error.message,
      timestamp: performance.now(),
    };
  }

  /**
   * Processes a response body and adds it to the result.
   * @param responseBody The response body stream
   * @param result The result object to populate
   */
  private async processResponseBody(
    responseBody: { text(): Promise<string> },
    result: RequestResult,
  ): Promise<void> {
    try {
      result.body = await responseBody.text();
    } catch (e) {
      // Ignore body read errors, it might be empty.
      result.body = `(Could not read body: ${(e as Error).message}`;
    }
  }

  /**
   * Creates a result for a rejected promise (shouldn't normally happen).
   * @param reason The rejection reason
   * @returns The processed RequestResult
   */
  createRejectedResult(reason: unknown): RequestResult {
    return {
      method: 'GET',
      url: 'unknown',
      status: 0,
      latencyMs: 0,
      success: false,
      error: reason?.toString() || 'Unknown error',
      timestamp: performance.now(),
    };
  }
}

/**
 * Interface for response sampling (to avoid circular dependencies)
 */
export interface ResponseSampler {
  shouldSampleResponse(
    method: string,
    url: string,
    statusCode: number,
  ): boolean;
}
