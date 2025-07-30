import { Agent, Dispatcher } from 'undici';

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

export class HttpAgentManager {
  private agents = new Map<string, Dispatcher>();
  private defaultConfig: AgentConfig;
  private useGlobalDispatcher: boolean;

  constructor(defaultConfig: AgentConfig = {}, useGlobalDispatcher = false) {
    this.defaultConfig = {
      connections: 128,
      keepAliveTimeout: 4000,
      keepAliveMaxTimeout: 60000,
      headersTimeout: 30000,
      bodyTimeout: 30000,
      ...defaultConfig,
    };
    this.useGlobalDispatcher = useGlobalDispatcher;
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
      const agent = new Agent({
        connections: mergedConfig.connections,
        keepAliveTimeout: mergedConfig.keepAliveTimeout,
        keepAliveMaxTimeout: mergedConfig.keepAliveMaxTimeout,
        headersTimeout: mergedConfig.headersTimeout,
        bodyTimeout: mergedConfig.bodyTimeout,
      });

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
      if ('close' in agent && typeof agent.close === 'function') {
        agent.close();
      }
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
   * Close all agents and clear the cache
   */
  closeAll(): void {
    for (const [, agent] of this.agents.entries()) {
      if ('close' in agent && typeof agent.close === 'function') {
        agent.close();
      }
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
