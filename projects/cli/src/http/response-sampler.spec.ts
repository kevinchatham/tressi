import { beforeEach, describe, expect, it } from 'vitest';

import { ResponseSampler } from './response-sampler';

describe('ResponseSampler', () => {
  let sampler: ResponseSampler;

  beforeEach(() => {
    sampler = new ResponseSampler();
  });

  describe('shouldSampleResponse', () => {
    it('should sample first response for a given endpoint and status code', () => {
      const result = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(result).toBe(true);
    });

    it('should not sample duplicate status codes for the same endpoint', () => {
      // First request - should sample
      const firstResult = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(firstResult).toBe(true);

      // Second request with same status code - should not sample
      const secondResult = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(secondResult).toBe(false);
    });

    it('should sample different status codes for the same endpoint', () => {
      // First 200 response - should sample
      const result200 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(result200).toBe(true);

      // First 404 response - should sample (different status code)
      const result404 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        404,
      );
      expect(result404).toBe(true);

      // Second 404 response - should not sample
      const result404Again = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        404,
      );
      expect(result404Again).toBe(false);
    });

    it('should differentiate between different HTTP methods on the same URL', () => {
      // GET request - should sample
      const getResult = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(getResult).toBe(true);

      // POST request with same URL and status - should sample (different method)
      const postResult = sampler.shouldSampleResponse(
        'POST',
        'http://example.com/api/users',
        200,
      );
      expect(postResult).toBe(true);

      // Second GET request - should not sample
      const getResult2 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(getResult2).toBe(false);
    });

    it('should differentiate between different endpoints', () => {
      // First endpoint - should sample
      const result1 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(result1).toBe(true);

      // Different endpoint - should sample
      const result2 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/posts',
        200,
      );
      expect(result2).toBe(true);

      // Second request to first endpoint - should not sample
      const result3 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        200,
      );
      expect(result3).toBe(false);
    });

    it('should handle error status codes', () => {
      // First 500 error - should sample
      const result500 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        500,
      );
      expect(result500).toBe(true);

      // Second 500 error - should not sample
      const result500Again = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        500,
      );
      expect(result500Again).toBe(false);

      // First 400 error - should sample (different status)
      const result400 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        400,
      );
      expect(result400).toBe(true);
    });

    it('should handle redirect status codes', () => {
      const result301 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        301,
      );
      expect(result301).toBe(true);

      const result301Again = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        301,
      );
      expect(result301Again).toBe(false);

      const result302 = sampler.shouldSampleResponse(
        'GET',
        'http://example.com/api/users',
        302,
      );
      expect(result302).toBe(true);
    });

    it('should handle various HTTP methods', () => {
      const methods = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'HEAD',
        'OPTIONS',
      ];

      methods.forEach((method) => {
        const result = sampler.shouldSampleResponse(
          method,
          'http://example.com/api/users',
          200,
        );
        expect(result).toBe(true);
      });

      // Second request for each method - should not sample
      methods.forEach((method) => {
        const result = sampler.shouldSampleResponse(
          method,
          'http://example.com/api/users',
          200,
        );
        expect(result).toBe(false);
      });
    });

    it('should handle URLs with query parameters', () => {
      const urlWithQuery = 'http://example.com/api/users?page=1&limit=10';

      const result1 = sampler.shouldSampleResponse('GET', urlWithQuery, 200);
      expect(result1).toBe(true);

      const result2 = sampler.shouldSampleResponse('GET', urlWithQuery, 200);
      expect(result2).toBe(false);

      // Same endpoint with different query params - should sample (different URL)
      const urlWithDifferentQuery =
        'http://example.com/api/users?page=2&limit=10';
      const result3 = sampler.shouldSampleResponse(
        'GET',
        urlWithDifferentQuery,
        200,
      );
      expect(result3).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      const urlWithFragment = 'http://example.com/api/users#section';

      const result1 = sampler.shouldSampleResponse('GET', urlWithFragment, 200);
      expect(result1).toBe(true);

      const result2 = sampler.shouldSampleResponse('GET', urlWithFragment, 200);
      expect(result2).toBe(false);
    });

    it('should handle HTTPS URLs', () => {
      const httpsUrl = 'https://api.example.com/users';

      const result = sampler.shouldSampleResponse('GET', httpsUrl, 200);
      expect(result).toBe(true);

      const resultAgain = sampler.shouldSampleResponse('GET', httpsUrl, 200);
      expect(resultAgain).toBe(false);
    });

    it('should handle URLs with ports', () => {
      const urlWithPort = 'http://example.com:8080/api/users';

      const result = sampler.shouldSampleResponse('GET', urlWithPort, 200);
      expect(result).toBe(true);

      const resultAgain = sampler.shouldSampleResponse('GET', urlWithPort, 200);
      expect(resultAgain).toBe(false);
    });

    it('should handle localhost URLs', () => {
      const localhostUrl = 'http://localhost:3000/api/test';

      const result = sampler.shouldSampleResponse('POST', localhostUrl, 201);
      expect(result).toBe(true);

      const resultAgain = sampler.shouldSampleResponse(
        'POST',
        localhostUrl,
        201,
      );
      expect(resultAgain).toBe(false);
    });

    it('should handle empty URL path', () => {
      const rootUrl = 'http://example.com';

      const result = sampler.shouldSampleResponse('GET', rootUrl, 200);
      expect(result).toBe(true);

      const resultAgain = sampler.shouldSampleResponse('GET', rootUrl, 200);
      expect(resultAgain).toBe(false);
    });

    it('should handle deeply nested paths', () => {
      const deepPath =
        'http://example.com/api/v1/users/123/posts/456/comments/789';

      const result = sampler.shouldSampleResponse('GET', deepPath, 200);
      expect(result).toBe(true);

      const resultAgain = sampler.shouldSampleResponse('GET', deepPath, 200);
      expect(resultAgain).toBe(false);
    });

    it('should track status codes independently per endpoint', () => {
      const endpoint = 'http://example.com/api/resource';

      // Sample multiple status codes
      expect(sampler.shouldSampleResponse('GET', endpoint, 200)).toBe(true);
      expect(sampler.shouldSampleResponse('GET', endpoint, 201)).toBe(true);
      expect(sampler.shouldSampleResponse('GET', endpoint, 400)).toBe(true);
      expect(sampler.shouldSampleResponse('GET', endpoint, 401)).toBe(true);
      expect(sampler.shouldSampleResponse('GET', endpoint, 500)).toBe(true);
      expect(sampler.shouldSampleResponse('GET', endpoint, 503)).toBe(true);

      // All subsequent requests should not be sampled
      expect(sampler.shouldSampleResponse('GET', endpoint, 200)).toBe(false);
      expect(sampler.shouldSampleResponse('GET', endpoint, 201)).toBe(false);
      expect(sampler.shouldSampleResponse('GET', endpoint, 400)).toBe(false);
      expect(sampler.shouldSampleResponse('GET', endpoint, 401)).toBe(false);
      expect(sampler.shouldSampleResponse('GET', endpoint, 500)).toBe(false);
      expect(sampler.shouldSampleResponse('GET', endpoint, 503)).toBe(false);
    });
  });

  describe('sampling strategy', () => {
    it('should provide representative samples without storing every response', () => {
      const sampler = new ResponseSampler();
      const endpoint = 'http://example.com/api/users';
      const statusCode = 200;

      // Simulate many requests
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(sampler.shouldSampleResponse('GET', endpoint, statusCode));
      }

      // Only the first request should be sampled
      expect(results.filter((r) => r).length).toBe(1);
      expect(results[0]).toBe(true);
      expect(results.slice(1).every((r) => r === false)).toBe(true);
    });

    it('should efficiently track multiple endpoints', () => {
      const endpoints = [
        'http://example.com/api/users',
        'http://example.com/api/posts',
        'http://example.com/api/comments',
      ];

      // Each endpoint should be sampled once
      endpoints.forEach((endpoint) => {
        expect(sampler.shouldSampleResponse('GET', endpoint, 200)).toBe(true);
      });

      // All subsequent requests should not be sampled
      endpoints.forEach((endpoint) => {
        expect(sampler.shouldSampleResponse('GET', endpoint, 200)).toBe(false);
      });
    });
  });
});
