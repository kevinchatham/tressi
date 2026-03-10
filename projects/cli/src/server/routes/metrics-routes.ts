import { sValidator } from '@hono/standard-validator';
import { ISSEClientManager } from '@tressi/shared/cli';
import { Hono } from 'hono';
import os from 'os';
import z from 'zod';

import { metricStorage } from '../../collections/metrics-collection';
import { createApiErrorResponse } from '../utils/error-response-generator';

/**
 * Creates a metrics streaming application using Server-Sent Events.
 * Provides realtime metrics data to connected clients.
 *
 * @param {ISSEClientManager} sseManager - Manager for handling SSE client connections
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMetricsApp(sseManager: ISSEClientManager) {
  return (
    new Hono()
      /**
       * GET /stream - Establishes SSE connection for realtime metrics streaming
       * @returns {Response} Server-Sent Events stream response
       */
      .get('/stream', (c) => {
        const stream = new ReadableStream({
          start: (controller: ReadableStreamDefaultController): void => {
            sseManager.addClient(controller);
            const connectionMessage = {
              type: 'connected',
              timestamp: Date.now(),
            };
            controller.enqueue(
              `data: ${JSON.stringify(connectionMessage)}\n\n`,
            );
            c.req.raw.signal.addEventListener('abort', () => {
              sseManager.removeClient(controller);
            });
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });
      })
      /**
       * GET /system - Get cpu count, memory, node version, os, etc
       */
      .get('/system', (c) => {
        return c.json({
          arch: os.arch(),
          cpuCount: os.cpus().length,
          freeMemory: os.freemem(),
          nodeVersion: process.version,
          platform: os.platform(),
          totalMemory: os.totalmem(),
        });
      })
      /**
       * GET /:testId - Retrieves all metrics for a specific test
       * @param {string} testId - The test ID from URL parameter
       * @returns {Promise<Response>} JSON array of metrics for the test
       */
      .get(
        '/:testId',
        sValidator(
          'param',
          z.object({
            testId: z.string(),
          }),
        ),
        async (c) => {
          try {
            const { testId } = c.req.valid('param');
            const metrics = await metricStorage.getByTestId(testId);
            return c.json(metrics);
          } catch (error) {
            return c.json(
              createApiErrorResponse(
                'Failed to load metrics',
                'INTERNAL_ERROR',
                error instanceof Error ? [error.message] : undefined,
              ),
              500,
            );
          }
        },
      )
  );
}

export default createMetricsApp;
