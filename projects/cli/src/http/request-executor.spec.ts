import type { RequestResult, TressiRequestConfig } from '@tressi/shared/common';
import { request as undiciRequest } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalAgentManager } from './agent-manager';
import { RequestExecutor } from './request-executor';
import { ResponseSampler } from './response-sampler';

// Mock the undici request function
vi.mock('undici', () => ({
  Agent: vi.fn().mockImplementation(() => ({})),
  Dispatcher: {},
  request: vi.fn(),
}));

// Mock the globalAgentManager
vi.mock('./agent-manager', () => ({
  globalAgentManager: {
    getAgent: vi.fn().mockReturnValue({}),
  },
}));

// Helper to create a minimal request config with required fields
function createRequestConfig(overrides: Partial<TressiRequestConfig> = {}): TressiRequestConfig {
  const defaults: TressiRequestConfig = {
    earlyExit: {
      enabled: false,
      errorRateThreshold: 0,
      exitStatusCodes: [],
      monitoringWindowMs: 0,
    },
    headers: {},
    method: 'GET',
    payload: {},
    rampUpDurationSec: 0,
    rps: 1,
    url: 'http://example.com/api/test',
  };
  return { ...defaults, ...overrides } as TressiRequestConfig;
}

describe('RequestExecutor', () => {
  let executor: RequestExecutor;
  let mockResponseSampler: ResponseSampler;
  let mockRequest: ReturnType<typeof vi.fn>;
  let shouldSampleResponseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResponseSampler = new ResponseSampler();
    executor = new RequestExecutor(mockResponseSampler, 100);
    mockRequest = undiciRequest as ReturnType<typeof vi.fn>;
    shouldSampleResponseSpy = vi.spyOn(mockResponseSampler, 'shouldSampleResponse');
  });

  describe('executeRequest', () => {
    it('should execute a successful GET request', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{"message":"success"}'),
        },
        headers: {
          'content-length': '26',
          'content-type': 'application/json',
        },
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(true);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.method).toBe('GET');
      expect(result.url).toBe('http://example.com/api/users');
      expect(result.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute a successful POST request with payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{"id":1}'),
        },
        headers: {
          'content-type': 'application/json',
        },
        statusCode: 201,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(true);

      const config = createRequestConfig({
        method: 'POST',
        payload: { email: 'john@example.com', name: 'John' },
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.method).toBe('POST');
      expect(result.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.bytesSent).toBeGreaterThan(0);
    });

    it('should handle request error gracefully', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.success).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toBe('Network error');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-2xx status codes as unsuccessful', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{"error":"Not found"}'),
        },
        headers: {
          'content-type': 'application/json',
        },
        statusCode: 404,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(true);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users/999',
      });

      const result = await executor.executeRequest(config);

      expect(result.status).toBe(404);
      expect(result.success).toBe(false);
    });

    it('should handle 5xx server errors', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('Internal Server Error'),
        },
        headers: {},
        statusCode: 500,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(true);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.status).toBe(500);
      expect(result.success).toBe(false);
    });

    it('should handle 3xx redirect status codes', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue(''),
        },
        headers: {
          location: 'http://example.com/new-location',
        },
        statusCode: 301,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.status).toBe(301);
      expect(result.success).toBe(false);
    });

    it('should merge global headers with request headers', async () => {
      // Capture the headers at call time
      let capturedHeaders: Record<string, string> = {};
      mockRequest.mockImplementation(
        (_url: string, options: { headers: Record<string, string> }) => {
          capturedHeaders = { ...options.headers };
          return Promise.resolve({
            body: { text: vi.fn().mockResolvedValue('{}') },
            headers: {},
            statusCode: 200,
          });
        },
      );
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        headers: { 'X-Request-Id': 'req-123' },
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const globalHeaders = {
        Authorization: 'Bearer token123',
        'X-Global-Header': 'global-value',
      };

      await executor.executeRequest(config, globalHeaders);

      // Check captured headers before they're cleared
      expect(capturedHeaders).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer token123',
          'X-Global-Header': 'global-value',
          'X-Request-Id': 'req-123',
        }),
      );
    });

    it('should not include payload for GET requests', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        payload: { shouldNotBeSent: true },
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should not include payload for DELETE requests', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue(''),
        },
        headers: {},
        statusCode: 204,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'DELETE',
        payload: { shouldNotBeSent: true },
        url: 'http://example.com/api/users/1',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users/1',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should include payload for POST requests', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 201,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const payload = { name: 'Test User' };
      const config = createRequestConfig({
        method: 'POST',
        payload,
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: JSON.stringify(payload),
        }),
      );
    });

    it('should include payload for PUT requests', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const payload = { name: 'Updated User' };
      const config = createRequestConfig({
        method: 'PUT',
        payload,
        url: 'http://example.com/api/users/1',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users/1',
        expect.objectContaining({
          body: JSON.stringify(payload),
        }),
      );
    });

    it('should include payload for PATCH requests', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const payload = { name: 'Patched User' };
      const config = createRequestConfig({
        method: 'PATCH',
        payload,
        url: 'http://example.com/api/users/1',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users/1',
        expect.objectContaining({
          body: JSON.stringify(payload),
        }),
      );
    });

    it('should not include null payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: null as unknown as TressiRequestConfig['payload'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should not include undefined payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: undefined as unknown as TressiRequestConfig['payload'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should not include empty object payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: {},
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should not include empty array payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: [],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should not include whitespace-only string payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: '   ' as unknown as TressiRequestConfig['payload'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it('should handle response body read error gracefully', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockRejectedValue(new Error('Read error')),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(true);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.success).toBe(true);
      expect(result.body).toContain('Could not read body');
    });

    it('should use content-length header when body is not read', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {
          'content-length': '1000',
        },
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.bytesReceived).toBe(1000);
    });

    it('should use default method GET when not specified', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should handle case-insensitive HTTP methods', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'post' as unknown as TressiRequestConfig['method'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          method: 'post',
        }),
      );
    });

    it('should track bytes sent correctly', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 201,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const payload = { name: 'Test' };
      const config = createRequestConfig({
        method: 'POST',
        payload,
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.bytesSent).toBe(Buffer.byteLength(JSON.stringify(payload), 'utf8'));
    });

    it('should track bytes received correctly', async () => {
      const bodyContent = '{"message":"test response"}';
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue(bodyContent),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(true);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.bytesReceived).toBe(Buffer.byteLength(bodyContent, 'utf8'));
    });

    it('should set timestamp on successful request', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const beforeTime = performance.now();
      const result = await executor.executeRequest(config);
      const afterTime = performance.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should set timestamp on failed request', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const beforeTime = performance.now();
      const result = await executor.executeRequest(config);
      const afterTime = performance.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should use globalAgentManager in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(globalAgentManager.getAgent).toHaveBeenCalledWith('http://example.com/api/users');
      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          dispatcher: {},
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not use globalAgentManager in test mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(globalAgentManager.getAgent).not.toHaveBeenCalled();
      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          dispatcher: undefined,
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle array content-length header', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {
          'content-length': ['500', '1000'],
        },
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.bytesReceived).toBe(500);
    });

    it('should handle non-numeric content-length header', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {
          'content-length': 'invalid',
        },
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.bytesReceived).toBe(0);
    });

    it('should handle empty response body', async () => {
      const mockResponse = {
        body: null,
        headers: {},
        statusCode: 204,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'DELETE',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.status).toBe(204);
      expect(result.body).toBeUndefined();
    });

    it('should not sample response when shouldSampleResponse returns false', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{"should not be read": true}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(mockResponse.body.text).not.toHaveBeenCalled();
      expect(result.body).toBeUndefined();
    });
  });

  describe('releaseResultObject', () => {
    it('should release result object back to pool', () => {
      const result: RequestResult = {
        body: 'test',
        bytesReceived: 0,
        bytesSent: 0,
        headers: {},
        latencyMs: 100,
        method: 'GET',
        status: 200,
        success: true,
        timestamp: Date.now(),
        url: 'http://example.com',
      };

      executor.releaseResultObject(result);

      // The result should be cleared and added to pool
      // We can't directly verify pool contents, but we can verify the object is cleared
      expect(result.method).toBe('');
      expect(result.url).toBe('');
    });

    it('should not release when pool is full', () => {
      // Create executor with small pool size
      const smallPoolExecutor = new RequestExecutor(mockResponseSampler, 1);

      const result1: RequestResult = {
        body: 'test',
        bytesReceived: 0,
        bytesSent: 0,
        headers: {},
        latencyMs: 100,
        method: 'GET',
        status: 200,
        success: true,
        timestamp: Date.now(),
        url: 'http://example.com',
      };

      const result2: RequestResult = {
        body: 'test2',
        bytesReceived: 0,
        bytesSent: 0,
        headers: {},
        latencyMs: 100,
        method: 'POST',
        status: 201,
        success: true,
        timestamp: Date.now(),
        url: 'http://example.com',
      };

      smallPoolExecutor.releaseResultObject(result1);
      smallPoolExecutor.releaseResultObject(result2);

      // result1 should be cleared (added to pool)
      expect(result1.method).toBe('');
      // result2 should NOT be cleared (pool is full)
      expect(result2.method).toBe('POST');
    });
  });

  describe('object pooling', () => {
    it('should reuse headers objects from pool', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      // Execute multiple requests
      await executor.executeRequest(config);
      await executor.executeRequest(config);
      await executor.executeRequest(config);

      // The mock should have been called 3 times
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('should reuse result objects from pool', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users',
      });

      // Execute multiple requests and release results
      const result1 = await executor.executeRequest(config);
      executor.releaseResultObject(result1);

      const result2 = await executor.executeRequest(config);
      executor.releaseResultObject(result2);

      const result3 = await executor.executeRequest(config);

      // All should succeed
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle request with all HTTP methods', async () => {
      const methods: TressiRequestConfig['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        const mockResponse = {
          body: {
            text: vi.fn().mockResolvedValue('{}'),
          },
          headers: {},
          statusCode: 200,
        };
        mockRequest.mockResolvedValue(mockResponse);
        shouldSampleResponseSpy.mockReturnValue(false);

        const config = createRequestConfig({
          method,
          url: 'http://example.com/api/test',
        });

        const result = await executor.executeRequest(config);
        expect(result.method).toBe(method);
      }
    });

    it('should handle HTTPS URLs', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'https://api.example.com/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.url).toBe('https://api.example.com/users');
      expect(mockRequest).toHaveBeenCalledWith('https://api.example.com/users', expect.anything());
    });

    it('should handle URLs with query parameters', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://example.com/api/users?page=1&limit=10&sort=name',
      });

      const result = await executor.executeRequest(config);

      expect(result.url).toContain('page=1');
      expect(result.url).toContain('limit=10');
    });

    it('should handle URLs with ports', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'GET',
        url: 'http://localhost:8080/api/users',
      });

      const result = await executor.executeRequest(config);

      expect(result.url).toContain('localhost:8080');
    });

    it('should handle numeric payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: 42 as unknown as TressiRequestConfig['payload'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: '42',
        }),
      );
    });

    it('should handle boolean payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const config = createRequestConfig({
        method: 'POST',
        payload: true as unknown as TressiRequestConfig['payload'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: 'true',
        }),
      );
    });

    it('should handle array payload', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 201,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      const payload = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const config = createRequestConfig({
        method: 'POST',
        payload,
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: JSON.stringify(payload),
        }),
      );
    });

    it('should handle non-JSON-serializable payload gracefully', async () => {
      const mockResponse = {
        body: {
          text: vi.fn().mockResolvedValue('{}'),
        },
        headers: {},
        statusCode: 200,
      };
      mockRequest.mockResolvedValue(mockResponse);
      shouldSampleResponseSpy.mockReturnValue(false);

      // Create a circular reference
      const circular: Record<string, unknown> = { value: 'test' };
      circular.self = circular;

      const config = createRequestConfig({
        method: 'POST',
        payload: circular as unknown as TressiRequestConfig['payload'],
        url: 'http://example.com/api/users',
      });

      await executor.executeRequest(config);

      // Should not throw, and body should be undefined
      expect(mockRequest).toHaveBeenCalledWith(
        'http://example.com/api/users',
        expect.objectContaining({
          body: undefined,
        }),
      );
    });
  });
});
