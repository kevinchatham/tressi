import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { LoadTestRequestSchema } from 'tressi-common/api';
import { ConfigValidationError, validateConfig } from 'tressi-common/config';

import { runLoadTest } from '../..';
import {
  createApiErrorResponse,
  createZodValidationErrorResponse,
} from '../utils/error-response-generator';

/**
 * Load test management routes for starting and monitoring load tests.
 * Supports single job execution with status tracking.
 */
let currentJob: {
  id: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
} | null = null;

const app = new Hono()
  /**
   * POST / - Starts a new load test job
   * Validates configuration and ensures only one job runs at a time
   * @param {LoadTestRequest} body - Load test configuration from request body
   * @returns {Promise<Response>} Job acceptance/rejection response with 202/409 status
   */
  .post('/', sValidator('json', LoadTestRequestSchema), async (c) => {
    try {
      if (currentJob?.status === 'running') {
        return c.json(
          {
            status: 'rejected' as const,
            message:
              'A load test is already running. Please wait for it to complete.',
          },
          409,
        );
      }
      const request = c.req.valid('json');
      const validationResult = validateConfig(request);
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
        return c.json(
          createApiErrorResponse('Invalid configuration', 'VALIDATION_ERROR', [
            'Configuration validation failed',
          ]),
          400,
        );
      }
      const jobId = `job_${Date.now()}`;
      currentJob = {
        id: jobId,
        status: 'running',
      };
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
      return c.json(
        {
          status: 'accepted' as const,
          message: 'Load test started successfully',
          jobId,
        },
        202,
      );
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          error instanceof Error ? error.message : 'Invalid request',
          'INVALID_REQUEST',
        ),
        400,
      );
    }
  })
  /**
   * GET /status - Retrieves the current load test job status
   * @returns {Promise<Response>} Current job status including running state, job ID, and any errors
   */
  .get('/status', async (c) => {
    if (!currentJob) {
      return c.json({
        isRunning: false,
      });
    }
    return c.json({
      isRunning: currentJob.status === 'running',
      jobId: currentJob.id,
      status: currentJob.status,
      error: currentJob.error,
    });
  });

export default app;
