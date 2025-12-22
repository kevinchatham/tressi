import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import z from 'zod';

import { runLoadTest } from '../..';
import { configStorage } from '../../collections/config-collection';
import { endpointMetricStorage } from '../../collections/endpoint-metrics-collection';
import { globalMetricStorage } from '../../collections/global-metrics-collection';
import { testStorage } from '../../collections/test-collection';
import { ServerEvents, TestEventData } from '../../events/event-types';
import { globalEventEmitter } from '../../events/global-event-emitter';
import { createApiErrorResponse } from '../utils/error-response-generator';
import { UITestSummary } from './types';

/**
 * Unified test management routes for handling both real-time test execution and persistent storage.
 * Provides endpoints for starting tests, CRUD operations, and status monitoring with persistent state.
 */
const app = new Hono()
  /**
   * POST / - Starts a new load test job
   * Validates configuration and creates persistent test record
   * @param {LoadTestRequest} body - Load test configuration from request body
   * @returns {Promise<Response>} Job acceptance/rejection response with 202/409 status
   */
  .post(
    '/',
    sValidator(
      'json',
      z.object({
        configId: z.string(),
      }),
    ),
    async (c) => {
      try {
        // Check for running tests using persistent storage
        const allTests = await testStorage.getAll();
        const runningTests = allTests.filter(
          (test) => test.status === 'running',
        );

        if (runningTests.length > 0) {
          return c.json(
            {
              status: 'rejected' as const,
              message:
                'A load test is already running. Please wait for it to complete.',
              jobId: runningTests[0].id,
            },
            409,
          );
        }

        const { configId } = c.req.valid('json');

        // Retrieve the configuration from storage
        const configDoc = await configStorage.getById(configId);
        if (!configDoc) {
          return c.json(
            createApiErrorResponse('Configuration not found', 'NOT_FOUND'),
            404,
          );
        }
        const config = configDoc.config;

        // Create test document with 'running' status
        const { id } = await testStorage.create({
          configId,
        });

        // Update status to running
        await testStorage.edit({
          id,
          configId,
          status: 'running',
          epochStartedAt: Date.now(),
        });

        // Emit test started event
        const startedEvent: TestEventData = {
          testId: id,
          timestamp: Date.now(),
          status: 'running',
          configId: configId,
        };
        globalEventEmitter.emit(ServerEvents.TEST.STARTED, startedEvent);

        // Start the load test asynchronously
        (async (): Promise<void> => {
          try {
            await runLoadTest(config);

            // Update test to completed status
            await testStorage.edit({
              id,
              configId,
              status: 'completed',
              epochEndedAt: Date.now(),
            });

            // Emit test completed event
            const completedEvent: TestEventData = {
              testId: id,
              timestamp: Date.now(),
              status: 'completed',
              configId: configId,
            };
            globalEventEmitter.emit(
              ServerEvents.TEST.COMPLETED,
              completedEvent,
            );
          } catch (error) {
            // Update test to failed status with error
            await testStorage.edit({
              id,
              configId,
              status: 'failed',
              epochEndedAt: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Emit test failed event
            const failedEvent: TestEventData = {
              testId: id,
              timestamp: Date.now(),
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              configId: configId,
            };
            globalEventEmitter.emit(ServerEvents.TEST.FAILED, failedEvent);
          }
        })();

        return c.json(
          {
            status: 'accepted' as const,
            message: 'Load test started successfully',
            testId: id,
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
    },
  )

  /**
   * GET /status - Retrieves the current load test job status
   * @returns {Promise<Response>} Current job status including running state, job ID, and any errors
   */
  .get('/status', async (c) => {
    try {
      const allTests = await testStorage.getAll();
      const runningTests = allTests.filter((test) => test.status === 'running');

      if (runningTests.length === 0) {
        return c.json({
          isRunning: false,
        });
      }

      const latestRunningTest = runningTests.sort(
        (a, b) => (b.epochStartedAt || 0) - (a.epochStartedAt || 0),
      )[0];

      return c.json({
        isRunning: true,
        jobId: latestRunningTest.id,
        status: latestRunningTest.status,
        error: latestRunningTest.error,
      });
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to get test status',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  })

  /**
   * GET / - Retrieves all tests
   * @returns {Promise<Response>} JSON array of tests
   */
  .get('/', async (c) => {
    try {
      const tests = await testStorage.getAll();
      return c.json(tests);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to load tests',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  })

  /**
   * GET /tests/:id - Retrieves a specific test by ID
   * @param {string} id - The test ID from URL parameter
   * @returns {Promise<Response>} JSON test data or error response
   */
  .get('/:id', sValidator('param', z.object({ id: z.string() })), async (c) => {
    try {
      const { id } = c.req.valid('param');
      const test = await testStorage.getById(id);
      if (!test) {
        return c.json(
          createApiErrorResponse('Test not found', 'NOT_FOUND'),
          404,
        );
      }
      return c.json(test);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to load test',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  })

  /**
   * DELETE /tests/:id - Deletes a test by ID and all associated metrics
   * @param {string} id - The test ID from URL parameter
   * @returns {Promise<Response>} Success response or error if not found
   */
  .delete(
    '/:id',
    sValidator('param', z.object({ id: z.string() })),
    async (c) => {
      try {
        const { id } = c.req.valid('param');
        // Check if test exists first
        const test = await testStorage.getById(id);
        if (!test) {
          return c.json(
            createApiErrorResponse('Test not found', 'NOT_FOUND'),
            404,
          );
        }

        // Delete all associated metrics first (cascade deletion)
        const globalMetricsDeleted =
          await globalMetricStorage.deleteByTestId(id);
        const endpointMetricsDeleted =
          await endpointMetricStorage.deleteByTestId(id);

        // Then delete the test itself
        const success = await testStorage.delete(id);
        if (!success) {
          return c.json(
            createApiErrorResponse('Test not found', 'NOT_FOUND'),
            404,
          );
        }

        return c.json({
          success: true,
          metricsDeleted: {
            global: globalMetricsDeleted,
            endpoints: endpointMetricsDeleted,
          },
        });
      } catch (error) {
        return c.json(
          createApiErrorResponse(
            'Failed to delete test',
            'INTERNAL_ERROR',
            error instanceof Error ? [error.message] : undefined,
          ),
          500,
        );
      }
    },
  )

  /**
   * GET /tests/:id/summary - Retrieves summary metrics for a test
   * @param {string} id - The test ID from URL parameter
   * @returns {Promise<Response>} JSON summary data or error response
   */
  .get(
    '/:id/summary',
    sValidator('param', z.object({ id: z.string() })),
    async (c) => {
      try {
        const { id } = c.req.valid('param');

        // Retrieve test document
        const test = await testStorage.getById(id);
        if (!test) {
          return c.json(
            createApiErrorResponse('Test not found', 'NOT_FOUND'),
            404,
          );
        }

        // Retrieve configuration to get duration
        const configDocument = await configStorage.getById(test.configId);
        const duration = configDocument?.config.options.durationSec || 0;

        // Get the last global metric
        const lastGlobalMetric = await globalMetricStorage.getLastByTestId(id);

        if (!lastGlobalMetric) {
          // No metrics found - return zero values
          return c.json({
            global: {
              totalRequests: 0,
              errorRate: test.status === 'failed' ? 100 : 0,
              requestsPerSecond: 0,
              averageLatency: 0,
              p50Latency: 0,
              p95Latency: 0,
              p99Latency: 0,
              failedRequests: 0,
              maxLatency: 0,
              minLatency: 0,
              networkBytesReceived: 0,
              networkBytesSent: 0,
              networkThroughputMBps: 0,
              statusCodeDistribution: {},
              successfulRequests: 0,
            },
            endpoints: {},
            duration,
            currentDuration:
              test.epochEndedAt && test.epochStartedAt
                ? test.epochEndedAt - test.epochStartedAt
                : 0,
          });
        }

        // Calculate current duration from last metric
        const currentDuration = test.epochStartedAt
          ? lastGlobalMetric.epoch - test.epochStartedAt
          : 0;

        // Get the last endpoint metrics for each URL
        const lastEndpointMetrics =
          await endpointMetricStorage.getLastByTestId(id);

        // Convert endpoint metrics to the required format
        const endpoints: Record<
          string,
          (typeof lastEndpointMetrics)[string]['metric']
        > = {};

        for (const [url, metricDoc] of Object.entries(lastEndpointMetrics)) {
          endpoints[url] = metricDoc.metric;
        }

        const summary: UITestSummary = {
          global: lastGlobalMetric.metric,
          endpoints,
          duration,
          currentDuration,
        };

        // Return summary with both global and endpoint metrics
        return c.json(summary);
      } catch (error) {
        return c.json(
          createApiErrorResponse(
            'Failed to load test summary',
            'INTERNAL_ERROR',
            error instanceof Error ? [error.message] : undefined,
          ),
          500,
        );
      }
    },
  );

export default app;
