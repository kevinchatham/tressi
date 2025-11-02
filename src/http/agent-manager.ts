import { Agent, Dispatcher } from 'undici';

import type { AgentConfig } from '../types';

/**
 * Manages HTTP agents for different endpoints during load testing.
 * This class provides per-endpoint agent management with connection pooling
 * and lifecycle management.
 */
export class AgentManager {
  private agents: Map<string, Dispatcher> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private defaultConfig: AgentConfig;

  /**
   * Creates a new AgentManager instance.
   * @param defaultConfig Default configuration for agents
   */
  constructor(defaultConfig: AgentConfig = {}) {
    this.defaultConfig = {
      connections: defaultConfig.connections ?? 128,
      keepAliveTimeout: defaultConfig.keepAliveTimeout ?? 4000,
      keepAliveMaxTimeout: defaultConfig.keepAliveMaxTimeout ?? 60000,
      headersTimeout: defaultConfig.headersTimeout ?? 30000,
      bodyTimeout: defaultConfig.bodyTimeout ?? 30000,
      ...defaultConfig,
    };
  }

  /**
   * Gets or creates an HTTP agent for the specified URL.
   * @param url The URL to get an agent for
   * @param config Optional agent configuration
   * @returns The HTTP dispatcher/agent for the URL
   */
  getAgent(url: string, config?: AgentConfig): Dispatcher {
    // Extract origin from URL
    const origin = this.extractOrigin(url);

    // Check if we already have an agent for this origin
    let agent = this.agents.get(origin);
    if (agent) {
      return agent;
    }

    // Create a new agent with merged configuration
    const mergedConfig = { ...this.defaultConfig, ...config };
    agent = new Agent(mergedConfig);

    // Store the agent and its configuration
    this.agents.set(origin, agent);
    this.agentConfigs.set(origin, mergedConfig);

    return agent;
  }

  /**
   * Gets the configuration for a specific agent.
   * @param url The URL to get configuration for
   * @returns The agent configuration or undefined if not found
   */
  getAgentConfig(url: string): AgentConfig | undefined {
    const origin = this.extractOrigin(url);
    return this.agentConfigs.get(origin);
  }

  /**
   * Updates the configuration for a specific agent.
   * @param url The URL to update configuration for
   * @param config New configuration
   * @returns true if agent was found and updated, false otherwise
   */
  updateAgentConfig(url: string, config: AgentConfig): boolean {
    const origin = this.extractOrigin(url);
    const existingAgent = this.agents.get(origin);

    if (!existingAgent) {
      return false;
    }

    // Close the existing agent
    this.closeAgent(origin);

    // Create a new agent with updated configuration
    const mergedConfig = { ...this.defaultConfig, ...config };
    const newAgent = new Agent(mergedConfig);

    this.agents.set(origin, newAgent);
    this.agentConfigs.set(origin, mergedConfig);

    return true;
  }

  /**
   * Closes a specific agent.
   * @param url The URL to close agent for
   * @returns Promise that resolves when agent is closed
   */
  async closeAgent(url: string): Promise<void> {
    const origin = this.extractOrigin(url);
    const agent = this.agents.get(origin);

    if (agent) {
      await agent.close();
      this.agents.delete(origin);
      this.agentConfigs.delete(origin);
    }
  }

  /**
   * Closes all managed agents.
   * @returns Promise that resolves when all agents are closed
   */
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [origin, agent] of this.agents) {
      closePromises.push(
        agent
          .close()
          .then(() => {
            this.agents.delete(origin);
            this.agentConfigs.delete(origin);
          })
          .catch((error) => {
            // Log error but continue closing other agents
            // eslint-disable-next-line no-console
            console.error(`Error closing agent for ${origin}:`, error);
          }),
      );
    }

    await Promise.allSettled(closePromises);
  }

  /**
   * Gets all managed origins.
   * @returns Array of origins
   */
  getOrigins(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Gets the number of managed agents.
   * @returns Number of agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Checks if an agent exists for a URL.
   * @param url The URL to check
   * @returns true if agent exists, false otherwise
   */
  hasAgent(url: string): boolean {
    const origin = this.extractOrigin(url);
    return this.agents.has(origin);
  }

  /**
   * Extracts the origin from a URL.
   * @param url The URL to extract origin from
   * @returns The origin (protocol + host + port)
   */
  private extractOrigin(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch {
      // If URL parsing fails, try to extract origin manually
      const match = url.match(/^https?:\/\/[^/]+/);
      return match ? match[0] : url;
    }
  }

  /**
   * Gets statistics about managed agents.
   * @returns Agent statistics
   */
  getStats(): AgentStats {
    const origins = this.getOrigins();
    return {
      totalAgents: origins.length,
      origins,
      defaultConfig: { ...this.defaultConfig },
    };
  }

  /**
   * Updates the default configuration for new agents.
   * @param config New default configuration
   */
  setDefaultConfig(config: AgentConfig): void {
    this.defaultConfig = {
      connections: config.connections ?? 128,
      keepAliveTimeout: config.keepAliveTimeout ?? 4000,
      keepAliveMaxTimeout: config.keepAliveMaxTimeout ?? 60000,
      headersTimeout: config.headersTimeout ?? 30000,
      bodyTimeout: config.bodyTimeout ?? 30000,
      ...config,
    };
  }

  /**
   * Gets the current default configuration.
   * @returns Current default configuration
   */
  getDefaultConfig(): AgentConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Clears all agents without closing them (use with caution).
   * This is useful for testing or emergency cleanup scenarios.
   */
  clear(): void {
    this.agents.clear();
    this.agentConfigs.clear();
  }
}

/**
 * Statistics about managed agents
 */
export interface AgentStats {
  /** Total number of agents */
  totalAgents: number;
  /** Array of origins being managed */
  origins: string[];
  /** Default configuration being used */
  defaultConfig: AgentConfig;
}

/**
 * Global instance of AgentManager for convenience.
 * This provides a singleton instance that can be used throughout the application.
 */
export const globalAgentManager = new AgentManager();

/**
 * Creates a new AgentManager instance with custom configuration.
 * @param config Configuration for the agent manager
 * @returns New AgentManager instance
 */
export function createAgentManager(config?: AgentConfig): AgentManager {
  return new AgentManager(config);
}
