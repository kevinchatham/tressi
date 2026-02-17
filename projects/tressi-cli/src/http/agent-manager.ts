import { Agent, Dispatcher } from 'undici';

import { AgentConfig } from '../reporting/types';

/**
 * Manages HTTP agents for different endpoints during load testing.
 * This class provides per-endpoint agent management with connection pooling
 * and lifecycle management.
 */
export class AgentManager {
  private _agents: Map<string, Dispatcher> = new Map();
  private _agentConfigs: Map<string, AgentConfig> = new Map();
  private _defaultConfig: AgentConfig = {
    connections: 256, // Maximum connections per origin
    keepAliveTimeout: 10000, // Keep connections alive longer
    keepAliveMaxTimeout: 120000,
    headersTimeout: 30000,
    bodyTimeout: 30000,
  };

  /**
   * Gets or creates an HTTP agent for the specified URL with connection pooling.
   *
   * @param url - The URL to get an agent for
   * @param config - Optional agent configuration to override defaults
   * @returns The HTTP dispatcher/agent for the URL
   *
   * @remarks
   * Implements a per-origin connection pooling strategy where each unique origin
   * (protocol + host + port) gets its own agent. This optimizes connection reuse
   * while preventing connection pool exhaustion.
   *
   * Agents are cached and reused across requests to the same origin, significantly
   * improving performance for load testing scenarios with repeated requests to the same endpoints.
   *
   * @example
   * ```typescript
   * const agent1 = agentManager.getAgent('https://api.example.com/users');
   * const agent2 = agentManager.getAgent('https://api.example.com/posts');
   * // Both requests use the same agent (same origin)
   * ```
   */
  getAgent(url: string, config?: AgentConfig): Dispatcher {
    // Extract origin from URL
    const origin = this._extractOrigin(url);

    // Check if we already have an agent for this origin
    let agent = this._agents.get(origin);
    if (agent) {
      return agent;
    }

    // Create a new agent with merged configuration
    const mergedConfig = { ...this._defaultConfig, ...config };
    agent = new Agent(mergedConfig);

    // Store the agent and its configuration
    this._agents.set(origin, agent);
    this._agentConfigs.set(origin, mergedConfig);

    return agent;
  }

  /**
   * Extracts the origin from a URL for connection pooling purposes.
   *
   * @param url - The URL to extract origin from
   * @returns The origin (protocol + host + port)
   *
   * @remarks
   * Uses the built-in URL parser when possible, with fallback to regex matching
   * for malformed URLs. The origin serves as the key for agent caching and
   * determines which connection pool will be used for a request.
   *
   * @example
   * ```typescript
   * extractOrigin('https://api.example.com:8080/v1/users');
   * // Returns: 'https://api.example.com:8080'
   * ```
   */
  private _extractOrigin(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch {
      // If URL parsing fails, try to extract origin manually
      const match = url.match(/^https?:\/\/[^/]+/);
      return match ? match[0] : url;
    }
  }
}

/**
 * Global instance of AgentManager for convenience.
 * This provides a singleton instance that can be used throughout the application.
 */
export const globalAgentManager = new AgentManager();
