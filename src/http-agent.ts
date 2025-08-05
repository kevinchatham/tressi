import { Agent, Dispatcher } from 'undici';

import { PerformanceMonitor } from './perf-monitor';

export interface AgentConfig {
  connections?: number;
  keepAliveTimeout?: number;
  keepAliveMaxTimeout?: number;
  headersTimeout?: number;
  bodyTimeout?: number;
}

export interface EndpointAgent {
  url: string;
  agent: Dispatcher;
}

export interface ConnectionPoolStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  pendingRequests: number;
}

/**
 * Extended Agent class with connection monitoring
 */
class MonitoredAgent extends Agent {
  private endpointKey: string;
  private perfMonitor: PerformanceMonitor;
  private activeConnections = 0;
  private totalConnections = 0;
  private pendingRequests = 0;

  constructor(
    options: ConstructorParameters<typeof Agent>[0],
    endpointKey: string,
  ) {
    super(options);
    this.endpointKey = endpointKey;
    this.perfMonitor = PerformanceMonitor.getInstance();
  }

  incrementActiveConnections(): void {
    this.activeConnections++;
    this.totalConnections++;
    this.recordConnectionMetrics();
  }

  decrementActiveConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    this.recordConnectionMetrics();
  }

  incrementPendingRequests(): void {
    this.pendingRequests++;
    this.recordConnectionMetrics();
  }

  decrementPendingRequests(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    this.recordConnectionMetrics();
  }

  private recordConnectionMetrics(): void {
    this.perfMonitor.recordResourceMetrics(
      { activeCount: 0, scalingEvents: 0, averageConcurrency: 0 },
      {
        activeConnections: this.activeConnections,
        idleConnections: Math.max(
          0,
          this.totalConnections - this.activeConnections,
        ),
        totalConnections: this.totalConnections,
        pendingRequests: this.pendingRequests,
      },
    );
  }

  getConnectionStats(): ConnectionPoolStats {
    return {
      activeConnections: this.activeConnections,
      idleConnections: Math.max(
        0,
        this.totalConnections - this.activeConnections,
      ),
      totalConnections: this.totalConnections,
      pendingRequests: this.pendingRequests,
    };
  }
}

export class HttpAgentManager {
  private agents = new Map<string, MonitoredAgent>();
  private defaultConfig: AgentConfig;
  private perfMonitor: PerformanceMonitor;

  constructor(defaultConfig: AgentConfig = {}) {
    this.defaultConfig = {
      connections: 1024,
      keepAliveTimeout: 4000,
      keepAliveMaxTimeout: 60000,
      headersTimeout: 30000,
      bodyTimeout: 30000,
      ...defaultConfig,
    };
    this.perfMonitor = PerformanceMonitor.getInstance();
  }

  /**
   * Get or create an agent for a specific endpoint
   * @param endpointUrl The endpoint URL
   * @param config Optional configuration override for this endpoint
   * @returns Dispatcher instance for the endpoint
   */
  getAgent(endpointUrl: string, config?: AgentConfig): Dispatcher {
    // In test environment, use global dispatcher (which can be mocked)
    if (process.env.NODE_ENV === 'test') {
      return undefined as never; // Let undici use global dispatcher
    }

    const key = this.getEndpointKey(endpointUrl);

    if (!this.agents.has(key)) {
      const mergedConfig = { ...this.defaultConfig, ...config };
      const agent = new MonitoredAgent(
        {
          connections: mergedConfig.connections,
          keepAliveTimeout: mergedConfig.keepAliveTimeout,
          keepAliveMaxTimeout: mergedConfig.keepAliveMaxTimeout,
          headersTimeout: mergedConfig.headersTimeout,
          bodyTimeout: mergedConfig.bodyTimeout,
        },
        key,
      );

      this.agents.set(key, agent);
    }

    return this.agents.get(key)!;
  }

  /**
   * Remove an agent for a specific endpoint
   * @param endpointUrl The endpoint URL
   */
  removeAgent(endpointUrl: string): boolean {
    const key = this.getEndpointKey(endpointUrl);
    const agent = this.agents.get(key);

    if (agent) {
      // Close the agent gracefully
      agent.close();
      return this.agents.delete(key);
    }

    return false;
  }

  /**
   * Get all active agents
   * @returns Array of endpoint-agent pairs
   */
  getAllAgents(): EndpointAgent[] {
    return Array.from(this.agents.entries()).map(([url, agent]) => ({
      url,
      agent,
    }));
  }

  /**
   * Get connection pool statistics for all endpoints
   * @returns Connection pool metrics by endpoint
   */
  getConnectionPoolStats(): Record<string, ConnectionPoolStats> {
    const stats: Record<string, ConnectionPoolStats> = {};

    for (const [url, agent] of this.agents.entries()) {
      stats[url] = agent.getConnectionStats();
    }

    return stats;
  }

  /**
   * Close all agents and clear the cache
   */
  closeAll(): void {
    for (const [, agent] of this.agents.entries()) {
      agent.close();
    }
    this.agents.clear();
  }

  /**
   * Get the number of active agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Generate a consistent key for an endpoint URL
   * @param endpointUrl The endpoint URL
   * @returns Normalized key for the endpoint
   */
  private getEndpointKey(endpointUrl: string): string {
    try {
      const url = new URL(endpointUrl);
      // Use origin (protocol + host + port) as the key to group similar endpoints
      return url.origin;
    } catch {
      // Fallback to the raw URL if parsing fails
      return endpointUrl;
    }
  }
}

// Global instance for convenience
export const globalAgentManager = new HttpAgentManager();

// Export for testing
export const createAgentManager = (config?: AgentConfig): HttpAgentManager =>
  new HttpAgentManager(config);
