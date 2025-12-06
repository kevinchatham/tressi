import { Hono } from 'hono';
import { BlankEnv } from 'hono/types';
import { StatusCode } from 'hono/utils/http-status';

import { ISSEClientManager } from '../../types/workers/interfaces';

/**
 * Creates a metrics streaming application using Server-Sent Events.
 * Provides real-time metrics data to connected clients.
 *
 * @param {ISSEClientManager} sseManager - Manager for handling SSE client connections
 * @returns {Hono} Hono app with metrics streaming endpoint
 */
function createMetricsApp(sseManager: ISSEClientManager): Hono<
  BlankEnv,
  {
    '/stream': {
      $get: {
        input: object;
        output: object;
        outputFormat: string;
        status: StatusCode;
      };
    };
  },
  '/'
> {
  return (
    new Hono()
      /**
       * GET /stream - Establishes SSE connection for real-time metrics streaming
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
  );
}

export default createMetricsApp;
