import {
  ErrorApiResponse,
  ValidationErrorApiResponse,
} from 'tressi-common/api';

import { ConfigMergeError, ConfigValidationError } from '../../types';

/**
 * Creates a standard API error response
 */
export function createApiErrorResponse(
  message: string,
  code?: string,
  details?: string[],
  path?: string,
): ErrorApiResponse {
  return {
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

/**
 * Creates a Zod validation error response with structured metadata
 */
export function createZodValidationErrorResponse(
  error: ConfigValidationError,
  path?: string,
): ValidationErrorApiResponse {
  return {
    error: {
      message: error.message,
      code: 'VALIDATION_ERROR',
      details: error.fieldErrors.map((err) => `${err.path}: ${err.message}`),
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

/**
 * Creates a configuration merge error response with structured metadata
 */
export function createConfigMergeErrorResponse(
  error: ConfigMergeError,
  path?: string,
): ValidationErrorApiResponse {
  return {
    error: {
      message: error.message,
      code: 'VALIDATION_ERROR',
      details: error.mergeFailures.map((err) => `${err.path}: ${err.message}`),
      timestamp: new Date().toISOString(),
      path,
    },
  };
}
