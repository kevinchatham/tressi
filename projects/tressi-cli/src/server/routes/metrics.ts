import { Hono } from 'hono';
import os from 'os';

import { ISSEClientManager } from '../../types/workers/interfaces';

/**
 * Creates a metrics streaming application using Server-Sent Events.
 * Provides real-time metrics data to connected clients.
 *
 * @param {ISSEClientManager} sseManager - Manager for handling SSE client connections
 * @returns {Hono} Hono app with metrics streaming endpoint
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMetricsApp(sseManager: ISSEClientManager) {
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
  );
}

export default createMetricsApp;
