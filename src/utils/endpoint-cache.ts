/**
 * Caches endpoint keys to avoid repeated string concatenation.
 * This optimization reduces memory allocations and improves performance.
 */
export class EndpointCache {
  private cache: Map<string, string> = new Map();

  /**
   * Gets a cached endpoint key or creates and caches a new one.
   * @param method The HTTP method
   * @param url The request URL
   * @returns The endpoint key
   */
  getEndpointKey(method: string, url: string): string {
    const cacheKey = `${method}|${url}`;
    let endpointKey = this.cache.get(cacheKey);

    if (!endpointKey) {
      endpointKey = `${method} ${url}`;
      this.cache.set(cacheKey, endpointKey);
    }

    return endpointKey;
  }

  /**
   * Gets a cached endpoint key without creating a new one if it doesn't exist.
   * @param method The HTTP method
   * @param url The request URL
   * @returns The endpoint key or undefined if not cached
   */
  getCachedEndpointKey(method: string, url: string): string | undefined {
    const cacheKey = `${method}|${url}`;
    return this.cache.get(cacheKey);
  }

  /**
   * Checks if an endpoint key is cached.
   * @param method The HTTP method
   * @param url The request URL
   * @returns true if the endpoint key is cached, false otherwise
   */
  hasEndpointKey(method: string, url: string): boolean {
    const cacheKey = `${method}|${url}`;
    return this.cache.has(cacheKey);
  }

  /**
   * Clears all cached endpoint keys.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets the number of cached endpoint keys.
   * @returns The number of cached keys
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Removes a specific endpoint key from the cache.
   * @param method The HTTP method
   * @param url The request URL
   * @returns true if the key was removed, false if it didn't exist
   */
  removeEndpointKey(method: string, url: string): boolean {
    const cacheKey = `${method}|${url}`;
    return this.cache.delete(cacheKey);
  }

  /**
   * Gets all cached endpoint keys.
   * @returns An array of all cached endpoint keys
   */
  getAllEndpointKeys(): string[] {
    return Array.from(this.cache.values());
  }

  /**
   * Gets all cache entries.
   * @returns An array of [cacheKey, endpointKey] tuples
   */
  getAllEntries(): [string, string][] {
    return Array.from(this.cache.entries());
  }

  /**
   * Checks if the cache is empty.
   * @returns true if the cache is empty, false otherwise
   */
  isEmpty(): boolean {
    return this.cache.size === 0;
  }
}

/**
 * Global instance of EndpointCache for convenience.
 * Note: In a dependency injection setup, this would be injected instead.
 */
export const globalEndpointCache = new EndpointCache();
