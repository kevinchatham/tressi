import { ServerEventMessage } from '../../events/event-types';
import { ISSEClientManager } from '../../workers/interfaces';

/**
 * Server-Sent Events client manager
 * Handles adding, removing, and broadcasting to connected clients
 */
export class SSEManager implements ISSEClientManager {
  private clients: Set<ReadableStreamDefaultController> = new Set();

  /**
   * Adds a new Server-Sent Events client connection.
   *
   * @param controller - The ReadableStream controller for the SSE connection
   *
   * @remarks
   * Stores the controller reference for broadcasting messages to this client.
   * The controller is used to enqueue data that will be sent to the connected client.
   * Multiple clients can be connected simultaneously, each receiving the same broadcast data.
   */
  addClient(controller: ReadableStreamDefaultController): void {
    this.clients.add(controller);
  }

  /**
   * Removes a Server-Sent Events client connection.
   *
   * @param controller - The ReadableStream controller to remove
   *
   * @remarks
   * Removes the controller from the active client set, preventing further broadcasts
   * to this client. Should be called when a client disconnects or the connection
   * is otherwise terminated.
   */
  removeClient(controller: ReadableStreamDefaultController): void {
    this.clients.delete(controller);
  }

  /**
   * Broadcasts a unified event message to all connected SSE clients.
   *
   * @param message - The unified event message to broadcast
   *
   * @remarks
   * Sends the provided message to all connected clients in SSE format.
   * Automatically handles client disconnections by removing failed clients
   * from the active set. Data is formatted according to SSE specification
   * with proper message framing.
   *
   * The method is resilient to individual client failures and will continue
   * broadcasting to remaining clients even if some fail.
   *
   * @example
   * ```typescript
   * sseManager.broadcast({
   *   event: ServerEvents.METRICS,
   *   data: { cpuUsagePercent: 50, memoryUsageMB: 128 }
   * });
   * // Sends: "data: {"event":"metrics","data":{"cpuUsagePercent":50,"memoryUsageMB":128}}\n\n"
   * ```
   */
  broadcast(message: ServerEventMessage): void {
    const sseMessage = `data: ${JSON.stringify(message)}\n\n`;

    for (const client of this.clients) {
      try {
        client.enqueue(sseMessage);
      } catch {
        // Client disconnected or failed, remove from set
        this.clients.delete(client);
      }
    }
  }

  /**
   * Gets the current number of connected SSE clients.
   *
   * @returns The count of active client connections
   *
   * @remarks
   * Useful for monitoring connection health and load. Can be used to determine
   * if broadcasts are reaching any clients or if the system is operating without
   * active listeners.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Cleans up all SSE client connections.
   *
   * @remarks
   * Closes all active client connections and clears the client set.
   * Used during graceful shutdown to ensure proper cleanup of resources.
   * Attempts to close each connection gracefully, ignoring any errors
   * that occur during the cleanup process.
   *
   * Should be called when the server is shutting down to prevent
   * resource leaks and ensure clean termination.
   */
  cleanup(): void {
    // Send a close message to all clients before closing
    for (const client of this.clients) {
      try {
        client.enqueue('event: close\ndata: Server shutting down\n\n');
        client.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.clients.clear();
  }

  /**
   * Forcefully terminates all SSE client connections.
   *
   * @remarks
   * Used for immediate shutdown when graceful cleanup fails.
   */
  forceClose(): void {
    for (const client of this.clients) {
      try {
        client.close();
      } catch {
        // Ignore errors during force close
      }
    }
    this.clients.clear();
  }
}
