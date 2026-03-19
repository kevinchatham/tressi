import type { AgentConfig } from '@tressi/shared/common';
import { Agent } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';

import { AgentManager, globalAgentManager } from './agent-manager';

describe('AgentManager', () => {
  let manager: AgentManager;

  beforeEach(() => {
    manager = new AgentManager();
  });

  describe('getAgent', () => {
    it('should create agent for new URL', () => {
      const agent = manager.getAgent('http://example.com');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should reuse agent for same origin', () => {
      const agent1 = manager.getAgent('http://example.com/path1');
      const agent2 = manager.getAgent('http://example.com/path2');

      expect(agent1).toBe(agent2);
    });

    it('should create different agents for different origins', () => {
      const agent1 = manager.getAgent('http://example.com');
      const agent2 = manager.getAgent('http://api.example.com');

      expect(agent1).not.toBe(agent2);
    });

    it('should handle HTTPS URLs', () => {
      const agent = manager.getAgent('https://example.com');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should handle URLs with ports', () => {
      const agent = manager.getAgent('http://localhost:8080');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should handle custom configuration', () => {
      const customConfig: AgentConfig = { connections: 10 };
      const agent = manager.getAgent('http://example.com', customConfig);
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });
  });

  describe('origin extraction', () => {
    it('should extract origin from HTTP URLs', () => {
      const origins = [
        'http://example.com',
        'http://example.com/path',
        'http://example.com:8080',
        'http://example.com:8080/path',
      ];

      origins.forEach((url) => {
        const agent = manager.getAgent(url);
        expect(agent).toBeDefined();
        expect(agent).toBeInstanceOf(Agent);
      });
    });

    it('should extract origin from HTTPS URLs', () => {
      const origins = [
        'https://example.com',
        'https://example.com/path',
        'https://example.com:443',
        'https://example.com:443/path',
      ];

      origins.forEach((url) => {
        const agent = manager.getAgent(url);
        expect(agent).toBeDefined();
        expect(agent).toBeInstanceOf(Agent);
      });
    });

    it('should handle malformed URLs gracefully', () => {
      const agent = manager.getAgent('not-a-valid-url');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should reuse agents for same origin across different paths', () => {
      const agent1 = manager.getAgent('http://example.com/api/v1');
      const agent2 = manager.getAgent('http://example.com/api/v2');
      const agent3 = manager.getAgent('http://example.com:8080/api/v1');

      expect(agent1).toBe(agent2);
      expect(agent1).not.toBe(agent3);
    });
  });

  describe('AgentManager core functionality', () => {
    it('should create agents that are instances of undici.Agent', () => {
      const agent = manager.getAgent('http://example.com');
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should reuse agents for the same origin', () => {
      const agent1 = manager.getAgent('http://example.com/path1');
      const agent2 = manager.getAgent('http://example.com/path2');
      expect(agent1).toBe(agent2);
    });

    it('should create different agents for different origins', () => {
      const agent1 = manager.getAgent('http://example.com');
      const agent2 = manager.getAgent('http://api.example.com');
      expect(agent1).not.toBe(agent2);
    });

    it('should handle custom configuration', () => {
      const customConfig: AgentConfig = { connections: 10 };
      const agent = manager.getAgent('http://example.com', customConfig);
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should extract origin correctly from various URL formats', () => {
      const testUrls = [
        'http://example.com',
        'http://example.com:8080',
        'https://example.com:443/path',
        'http://example.com/path?query=param',
        'http://example.com/path#fragment',
      ];

      const agents = testUrls.map((url) => manager.getAgent(url));
      // All URLs with same origin should return same agent
      expect(agents[0]).toBe(agents[3]); // same origin, different path
      expect(agents[0]).toBe(agents[4]); // same origin, different fragment
    });

    it('should handle malformed URLs gracefully', () => {
      expect(() => manager.getAgent('not-a-valid-url')).not.toThrow();
      const agent = manager.getAgent('not-a-valid-url');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });
  });

  describe('globalAgentManager', () => {
    it('should be an instance of AgentManager', () => {
      expect(globalAgentManager).toBeInstanceOf(AgentManager);
    });

    it('should provide functional getAgent method', () => {
      const agent = globalAgentManager.getAgent('http://example.com');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });
  });
});
