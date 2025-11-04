import type { TressiRequestConfig } from '../types';

/**
 * Factory for creating and configuring HTTP requests.
 * This class handles request creation, header merging, and payload serialization.
 */
export class RequestFactory {
  /**
   * Creates a properly configured request configuration.
   * @param baseConfig The base request configuration
   * @param globalHeaders Optional global headers to merge
   * @returns The configured request configuration
   */
  createRequest(
    baseConfig: TressiRequestConfig,
    globalHeaders?: Record<string, string>,
  ): TressiRequestConfig {
    const method = baseConfig.method || 'GET';
    const headers = this.mergeHeaders(globalHeaders, baseConfig.headers);

    return {
      ...baseConfig,
      method,
      headers,
    };
  }

  /**
   * Merges global headers with request-specific headers.
   * Request-specific headers take precedence over global headers.
   * @param globalHeaders Global headers to apply
   * @param requestHeaders Request-specific headers
   * @returns Merged headers object
   */
  private mergeHeaders(
    globalHeaders?: Record<string, string>,
    requestHeaders?: Record<string, string>,
  ): Record<string, string> | undefined {
    if (!globalHeaders && !requestHeaders) {
      return undefined;
    }

    if (!globalHeaders) {
      return requestHeaders;
    }

    if (!requestHeaders) {
      return globalHeaders;
    }

    // Request headers take precedence over global headers
    return { ...globalHeaders, ...requestHeaders };
  }

  /**
   * Serializes request payload to JSON if present.
   * @param payload The payload to serialize
   * @returns Serialized payload or undefined
   */
  private serializePayload(
    payload: Record<string, unknown> | unknown[] | undefined,
  ): string | undefined {
    if (payload === undefined) {
      return undefined;
    }

    return JSON.stringify(payload);
  }

  /**
   * Gets the serialized payload for a request.
   * @param config The request configuration
   * @returns Serialized payload or undefined
   */
  getSerializedPayload(config: TressiRequestConfig): string | undefined {
    return this.serializePayload(config.payload);
  }

  /**
   * Validates a request configuration.
   * @param config The request configuration to validate
   * @returns true if the configuration is valid
   */
  validateRequest(config: TressiRequestConfig): boolean {
    if (!config.url) {
      return false;
    }

    // Basic URL validation
    try {
      new URL(config.url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates a batch of identical requests for concurrent execution.
   * @param baseConfig The base request configuration
   * @param count The number of requests to create
   * @param globalHeaders Optional global headers
   * @returns Array of request configurations
   */
  createRequestBatch(
    baseConfig: TressiRequestConfig,
    count: number,
    globalHeaders?: Record<string, string>,
  ): TressiRequestConfig[] {
    const requests: TressiRequestConfig[] = [];

    for (let i = 0; i < count; i++) {
      requests.push(this.createRequest(baseConfig, globalHeaders));
    }

    return requests;
  }
}
