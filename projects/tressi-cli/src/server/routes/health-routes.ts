import { Hono } from 'hono';

import { ISSEClientManager } from '../../workers/interfaces';

/**
 * Creates a health monitoring application with Server-Sent Events heartbeat.
 * Provides real-time health status to connected clients.
 *
 * @param {ISSEClientManager} sseManager - Manager for handling SSE client connections
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createHealthApp(sseManager: ISSEClientManager) {
  return (
    new Hono()
      /**
       * GET / - Returns health status of the service
       * @returns {Response} JSON response with health status information
       */
      .get('/', (c) => {
        return c.json({
          status: 'ok',
          service: 'tressi-server',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        });
      })
      /**
       * GET /heartbeat - Server-Sent Events endpoint for real-time health monitoring
       * @returns {Response} SSE stream with heartbeat messages every 5 seconds
       */
      .get('/heartbeat', (c) => {
        const stream = new ReadableStream({
          start(controller) {
            sseManager.addClient(controller);

            // Send initial heartbeat
            const sendHeartbeat = (): void => {
              const message = {
                status: 'ok',
                timestamp: Date.now(),
              };
              try {
                controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
              } catch {
                // Client disconnected, cleanup will happen in cleanup
              }
            };

            // Send heartbeat immediately
            sendHeartbeat();

            // Send heartbeat every 5 seconds
            const intervalId = setInterval(sendHeartbeat, 5000);

            // Handle client disconnect
            c.req.raw.signal.addEventListener('abort', () => {
              clearInterval(intervalId);
              clearTimeout(timeoutId);
              sseManager.removeClient(controller);
            });

            // Set a timeout to prevent hanging connections
            const timeoutId = setTimeout(() => {
              clearInterval(intervalId);
              sseManager.removeClient(controller);
              try {
                controller.close();
              } catch {
                // Ignore close errors
              }
            }, 300000); // 5 minute timeout

            return (): void => {
              clearInterval(intervalId);
              clearTimeout(timeoutId);
              sseManager.removeClient(controller);
            };
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

export default createHealthApp;
