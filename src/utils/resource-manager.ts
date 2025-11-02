import { EventEmitter } from 'events';
import type { Dispatcher } from 'undici';

/**
 * Manages resource lifecycle and cleanup for load testing.
 * This class coordinates the cleanup of various resources like HTTP agents, timers, and memory pools.
 */
export class ResourceManager extends EventEmitter {
  private resources: Map<string, Resource> = new Map();
  private shuttingDown = false;

  /**
   * Registers a resource for lifecycle management.
   * @param name Unique name for the resource
   * @param resource The resource to manage
   */
  registerResource(name: string, resource: Resource): void {
    if (this.shuttingDown) {
      throw new Error('Cannot register resources during shutdown');
    }

    this.resources.set(name, resource);
    this.emit('resourceRegistered', name);
  }

  /**
   * Unregisters a resource from lifecycle management.
   * @param name Name of the resource to unregister
   * @returns true if the resource was found and removed, false otherwise
   */
  unregisterResource(name: string): boolean {
    const existed = this.resources.delete(name);
    if (existed) {
      this.emit('resourceUnregistered', name);
    }
    return existed;
  }

  /**
   * Gets a registered resource by name.
   * @param name Name of the resource
   * @returns The resource or undefined if not found
   */
  getResource(name: string): Resource | undefined {
    return this.resources.get(name);
  }

  /**
   * Checks if a resource is registered.
   * @param name Name of the resource
   * @returns true if the resource is registered, false otherwise
   */
  hasResource(name: string): boolean {
    return this.resources.has(name);
  }

  /**
   * Cleans up all registered resources.
   * @returns Promise that resolves when all resources are cleaned up
   */
  async cleanupAll(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.emit('cleanupStarted');

    const cleanupPromises: Promise<void>[] = [];

    for (const [name, resource] of this.resources) {
      try {
        const cleanupPromise = resource.cleanup();
        if (cleanupPromise instanceof Promise) {
          cleanupPromises.push(cleanupPromise);
        }
        this.emit('resourceCleanedUp', name);
      } catch (error) {
        this.emit('resourceCleanupError', name, error);
      }
    }

    // Wait for all async cleanups to complete
    await Promise.allSettled(cleanupPromises);

    this.resources.clear();
    this.shuttingDown = false;
    this.emit('cleanupCompleted');
  }

  /**
   * Cleans up a specific resource.
   * @param name Name of the resource to clean up
   * @returns Promise that resolves when the resource is cleaned up
   */
  async cleanupResource(name: string): Promise<void> {
    const resource = this.resources.get(name);
    if (!resource) {
      return;
    }

    try {
      await resource.cleanup();
      this.resources.delete(name);
      this.emit('resourceCleanedUp', name);
    } catch (error) {
      this.emit('resourceCleanupError', name, error);
      throw error;
    }
  }

  /**
   * Gets all registered resource names.
   * @returns Array of resource names
   */
  getResourceNames(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Gets the number of registered resources.
   * @returns The number of resources
   */
  getResourceCount(): number {
    return this.resources.size;
  }

  /**
   * Checks if the resource manager is shutting down.
   * @returns true if shutting down, false otherwise
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Clears all resources without cleaning them up (use with caution).
   * This is useful for testing or emergency cleanup scenarios.
   */
  clear(): void {
    this.resources.clear();
    this.shuttingDown = false;
  }
}

/**
 * Interface for resources that can be managed by the ResourceManager
 */
export interface Resource {
  /**
   * Cleans up the resource.
   * @returns void or Promise that resolves when cleanup is complete
   */
  cleanup(): void | Promise<void>;
}

/**
 * HTTP Agent resource for cleanup
 */
export class HttpAgentResource implements Resource {
  constructor(private agent: Dispatcher) {}

  async cleanup(): Promise<void> {
    // Close the HTTP agent
    await this.agent.close();
  }
}

/**
 * Timer resource for cleanup
 */
export class TimerResource implements Resource {
  constructor(private timer: NodeJS.Timeout | NodeJS.Immediate) {}

  cleanup(): void {
    if ('refresh' in this.timer) {
      // It's a Timeout
      clearTimeout(this.timer as NodeJS.Timeout);
    } else {
      // It's an Immediate
      clearImmediate(this.timer as NodeJS.Immediate);
    }
  }
}

/**
 * Interval resource for cleanup
 */
export class IntervalResource implements Resource {
  constructor(private interval: NodeJS.Timeout) {}

  cleanup(): void {
    clearInterval(this.interval);
  }
}

/**
 * Object pool resource for cleanup
 */
export class ObjectPoolResource implements Resource {
  constructor(private pool: { clear(): void }) {}

  cleanup(): void {
    this.pool.clear();
  }
}

/**
 * Map resource for cleanup
 */
export class MapResource<K, V> implements Resource {
  constructor(private map: Map<K, V>) {}

  cleanup(): void {
    this.map.clear();
  }
}

/**
 * Global instance of ResourceManager for convenience.
 * Note: In a dependency injection setup, this would be injected instead.
 */
export const globalResourceManager = new ResourceManager();
