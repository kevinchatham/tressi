import { describe, expect, it } from 'vitest';

import { createApiErrorResponse } from './error-response-generator';

describe('createApiErrorResponse', () => {
  it('should create a standard API error response with required fields', () => {
    const message = 'Test error';
    const response = createApiErrorResponse(message);

    expect(response).toEqual({
      error: {
        message,
        timestamp: expect.any(Number),
      },
    });
  });

  it('should include optional fields when provided', () => {
    const message = 'Test error';
    const code = 'ERR_TEST';
    const details = ['detail1', 'detail2'];
    const path = '/test/path';
    const response = createApiErrorResponse(message, code, details, path);

    expect(response).toEqual({
      error: {
        code,
        details,
        message,
        path,
        timestamp: expect.any(Number),
      },
    });
  });
});
