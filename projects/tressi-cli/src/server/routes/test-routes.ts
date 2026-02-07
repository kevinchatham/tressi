import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import z from 'zod';

import { configStorage } from '../../collections/config-collection';
import { endpointMetricStorage } from '../../collections/endpoint-metrics-collection';
import { globalMetricStorage } from '../../collections/global-metrics-collection';
import { testStorage } from '../../collections/test-collection';
import { runLoadTestForServer } from '../../core/test-executor';
import { ServerEvents, TestEventData } from '../../events/event-types';
import { globalEventEmitter } from '../../events/global-event-emitter';
import { JsonExporter } from '../../reporting/exporters/json-exporter';
import { MarkdownExporter } from '../../reporting/exporters/markdown-exporter';
import { XlsxExporter } from '../../reporting/exporters/xlsx-exporter';
import { createApiErrorResponse } from '../utils/error-response-generator';

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

        // Create test document with 'running' status
        const { id } = await testStorage.create({
          configId,
        });

        // Update status to running (epochStartedAt is now set in the embedded summary)
        await testStorage.edit({
          id,
          configId,
          status: 'running',
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
            // runLoadTestForServer now returns the summary (looks up config from testId)
            const summary = await runLoadTestForServer(id);

            // Update test to completed status WITH embedded summary
            // The summary now contains epochStartedAt and epochEndedAt
            await testStorage.edit({
              id,
              configId,
              status: 'completed',
              summary: summary, // ← EMBED SUMMARY DIRECTLY
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
            // Update test to failed status - summary is null for failures
            await testStorage.edit({
              id,
              configId,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              summary: null, // ← NULL FOR FAILED TESTS
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
        (a, b) =>
          (b.summary?.global.epochStartedAt || b.epochCreatedAt || 0) -
          (a.summary?.global.epochStartedAt || a.epochCreatedAt || 0),
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
   * GET /tests/:id/export - Exports test results in various formats
   * @param {string} id - The test ID from URL parameter
   * @param {string} format - Export format (xlsx, json, markdown)
   * @returns {Promise<Response>} File download response
   */
  .get(
    '/:id/export',
    sValidator('param', z.object({ id: z.string() })),
    sValidator('query', z.object({ format: z.enum(['xlsx', 'json', 'md']) })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { format } = c.req.valid('query');

      // Validate test exists
      const test = await testStorage.getById(id);
      if (!test) {
        return c.json(
          createApiErrorResponse('Test not found', 'NOT_FOUND'),
          404,
        );
      }

      const summary = test.summary;
      if (!summary) {
        return c.json(
          createApiErrorResponse('No test summary available', 'NO_CONTENT'),
          400,
        );
      }

      // Fetch time-series metrics
      // const globalMetrics = await globalMetricStorage.getByTestId(id);
      // const endpointMetrics = await endpointMetricStorage.getByTestId(id);

      // Handle JSON format

      try {
        switch (format) {
          case 'json':
            const exporter = new JsonExporter();
            const jsonContent = await exporter.export(summary);
            const jsonBuffer = Buffer.from(jsonContent!, 'utf-8');
            return new Response(jsonBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="test-${id}.json"`,
              },
            });
          case 'md':
            const markdownExporter = new MarkdownExporter();
            const markdownContent = await markdownExporter.export(summary);
            const markdownBuffer = Buffer.from(markdownContent!, 'utf-8');
            return new Response(markdownBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'text/markdown',
                'Content-Disposition': `attachment; filename="test-${id}.md"; filename*=UTF-8''test-${id}.md`,
              },
            });
          case 'xlsx':
            const xlsxExporter = new XlsxExporter();
            const xlsxContent = await xlsxExporter.export(summary);
            const buffer = Buffer.from(xlsxContent!);
            return new Response(buffer, {
              status: 200,
              headers: {
                'Content-Type':
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="test-${id}.xlsx"`,
              },
            });
          default:
            return c.json(
              createApiErrorResponse('Invalid export format', 'INVALID_FORMAT'),
              400,
            );
        }
      } catch (error) {
        return c.json(
          createApiErrorResponse(
            error instanceof Error ? error.message : 'Export failed',
            'EXPORT_FAILED',
          ),
          500,
        );
      }
    },
  );

export default app;
