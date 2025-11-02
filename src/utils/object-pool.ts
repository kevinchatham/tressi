/**
 * Generic object pool for efficient memory management.
 * This class provides a pool of reusable objects to reduce garbage collection pressure.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private maxSize: number;
  private factory: () => T;
  private reset: (obj: T) => void;

  /**
   * Creates a new ObjectPool instance.
   * @param factory Function to create new objects
   * @param reset Function to reset objects for reuse
   * @param maxSize Maximum number of objects to keep in the pool
   * @param initialSize Initial number of objects to create
   */
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 1000,
    initialSize: number = 0,
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Pre-populate the pool if initial size is specified
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Gets an object from the pool or creates a new one if the pool is empty.
   * @returns An object from the pool or a new object
   */
  acquire(): T {
    return this.pool.pop() || this.factory();
  }

  /**
   * Returns an object to the pool for reuse.
   * @param obj The object to return to the pool
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
    // If pool is full, the object will be garbage collected
  }

  /**
   * Clears all objects from the pool.
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Gets the current size of the pool.
   * @returns The number of objects in the pool
   */
  getSize(): number {
    return this.pool.length;
  }

  /**
   * Gets the maximum size of the pool.
   * @returns The maximum number of objects the pool can hold
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Checks if the pool is empty.
   * @returns true if the pool is empty, false otherwise
   */
  isEmpty(): boolean {
    return this.pool.length === 0;
  }

  /**
   * Checks if the pool is full.
   * @returns true if the pool is full, false otherwise
   */
  isFull(): boolean {
    return this.pool.length >= this.maxSize;
  }
}

/**
 * Specialized object pool for headers objects.
 */
export class HeadersPool extends ObjectPool<Record<string, string>> {
  constructor(maxSize: number = 1000, initialSize: number = 0) {
    super(
      () => ({}),
      (headers) => {
        // Clear all properties from the headers object
        for (const key in headers) {
          delete headers[key];
        }
      },
      maxSize,
      initialSize,
    );
  }
}

/**
 * Specialized object pool for RequestResult objects.
 */
export class ResultPool extends ObjectPool<RequestResult> {
  constructor(maxSize: number = 1000, initialSize: number = 0) {
    super(
      () => ({}) as RequestResult,
      (result) => {
        // Reset all properties of the result object
        result.method = '';
        result.url = '';
        result.status = 0;
        result.latencyMs = 0;
        result.success = false;
        result.body = undefined;
        result.error = undefined;
        result.timestamp = 0;
      },
      maxSize,
      initialSize,
    );
  }
}

// Import RequestResult type
import type { RequestResult } from '../types';
