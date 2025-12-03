import type { Handler } from 'hono';

import { ISSEClientManager } from '../../types/workers/interfaces';

/**
 * Create metrics streaming endpoint handler
 *
 * Note: This handler returns a raw Response object for Server-Sent Events (SSE) streaming,
 * not a JSON response. Since SSE uses text/event-stream content type and streams data
 * continuously, it doesn't use TypedResponse like our JSON endpoints. The Response object
 * is created manually with the appropriate headers for SSE streaming.
 */
export function createMetricsHandler(sseManager: ISSEClientManager): Handler {
  return (c) => {
    const stream = new ReadableStream({
      start: (controller: ReadableStreamDefaultController): void => {
        sseManager.addClient(controller);

        // Send connection confirmation
        const connectionMessage = {
          type: 'connected',
          timestamp: Date.now(),
        };
        controller.enqueue(`data: ${JSON.stringify(connectionMessage)}\n\n`);

        // Clean up on disconnect
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
  };
}
