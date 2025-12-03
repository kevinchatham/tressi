import { sValidator } from '@hono/standard-validator';
import type { TypedResponse } from 'hono';
import { createFactory } from 'hono/factory';
import {
  ErrorApiResponse,
  JobStatusApiResponse,
  LoadTestApiResponse,
  LoadTestRequestSchema,
  ValidationErrorApiResponse,
} from 'tressi-common/api';

import { runLoadTest } from '../..';
import { validateAndMergeConfig } from '../../core/config';
import { ConfigValidationError } from '../../types';
import {
  createApiErrorResponse,
  createZodValidationErrorResponse,
} from '../utils/error-response-generator';

// Single job tracking (only one job at a time)
let currentJob: {
  id: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
} | null = null;

const factory = createFactory();

/**
 * POST /api/load-test - Start a load test (async only)
 */
export const loadTestHandler = factory.createHandlers(
  sValidator('json', LoadTestRequestSchema),
  async (
    c,
  ): Promise<
    | TypedResponse<LoadTestApiResponse>
    | TypedResponse<ValidationErrorApiResponse>
    | TypedResponse<ErrorApiResponse>
  > => {
    try {
      // Check if a job is already running
      if (currentJob?.status === 'running') {
        const response: LoadTestApiResponse = {
          status: 'rejected',
          message:
            'A load test is already running. Please wait for it to complete.',
        };
        return c.json(response, 409);
      }

      const request = c.req.valid('json');

      // Validate config using the safe validation function
      const validationResult = validateAndMergeConfig(request);

      if (!validationResult.success) {
        if (validationResult.error instanceof ConfigValidationError) {
          return c.json(
            createZodValidationErrorResponse(
              validationResult.error,
              c.req.path,
            ),
            400,
          );
        }

        // For other validation errors, use generic API error
        return c.json(
          createApiErrorResponse('Invalid configuration', 'VALIDATION_ERROR', [
            validationResult.error.message,
          ]),
          400,
        );
      }

      // TypeScript narrows type to SafeTressiConfig
      // Generate job ID
      const jobId = `job_${Date.now()}`;

      // Set current job to running
      currentJob = {
        id: jobId,
        status: 'running',
      };

      // Start execution in background (don't await)
      (async (): Promise<void> => {
        try {
          await runLoadTest(validationResult.data);
          if (currentJob?.id === jobId) {
            currentJob.status = 'completed';
          }
        } catch (error) {
          if (currentJob?.id === jobId) {
            currentJob.status = 'failed';
            currentJob.error =
              error instanceof Error ? error.message : 'Unknown error';
          }
        }
      })();

      const response: LoadTestApiResponse = {
        status: 'accepted',
        message: 'Load test started successfully',
        jobId,
      };
      return c.json(response, 202);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          error instanceof Error ? error.message : 'Invalid request',
          'INVALID_REQUEST',
        ),
        400,
      );
    }
  },
);

/**
 * GET /api/load-test/status - Get current job status
 */
export const jobStatusHandler = factory.createHandlers(
  async (c): Promise<TypedResponse<JobStatusApiResponse>> => {
    if (!currentJob) {
      const response: JobStatusApiResponse = {
        isRunning: false,
      };
      return c.json(response);
    }

    const response: JobStatusApiResponse = {
      isRunning: currentJob.status === 'running',
      jobId: currentJob.id,
      status: currentJob.status,
      error: currentJob.error,
    };
    return c.json(response);
  },
);
