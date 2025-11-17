import { beforeEach, describe, expect, it } from 'vitest';

import {
  AgentManager,
  createAgentManager,
} from '../../../src/http/agent-manager';
import type { AgentConfig } from '../../../src/types';

describe('AgentManager', () => {
  let manager: AgentManager;

  beforeEach(() => {
    manager = new AgentManager();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = manager.getDefaultConfig();
      expect(config.connections).toBe(128);
      expect(config.keepAliveTimeout).toBe(4000);
      expect(config.keepAliveMaxTimeout).toBe(60000);
      expect(config.headersTimeout).toBe(30000);
      expect(config.bodyTimeout).toBe(30000);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: AgentConfig = {
        connections: 10,
        keepAliveTimeout: 5000,
        keepAliveMaxTimeout: 30000,
      };
      const customManager = new AgentManager(customConfig);

      const config = customManager.getDefaultConfig();
      expect(config.connections).toBe(10);
      expect(config.keepAliveTimeout).toBe(5000);
      expect(config.keepAliveMaxTimeout).toBe(30000);
    });
  });

  describe('getAgent', () => {
    it('should create agent for new URL', () => {
      const agent = manager.getAgent('http://example.com');
      expect(agent).toBeDefined();
      expect(manager.hasAgent('http://example.com')).toBe(true);
    });

    it('should reuse agent for same origin', () => {
      const agent1 = manager.getAgent('http://example.com/path1');
      const agent2 = manager.getAgent('http://example.com/path2');

      expect(agent1).toBe(agent2);
      expect(manager.getAgentCount()).toBe(1);
    });

    it('should create different agents for different origins', () => {
      const agent1 = manager.getAgent('http://example.com');
      const agent2 = manager.getAgent('http://api.example.com');

      expect(agent1).not.toBe(agent2);
      expect(manager.getAgentCount()).toBe(2);
    });

    it('should handle HTTPS URLs', () => {
      const agent = manager.getAgent('https://example.com');
      expect(agent).toBeDefined();
      expect(manager.hasAgent('https://example.com')).toBe(true);
    });

    it('should handle URLs with ports', () => {
      const agent = manager.getAgent('http://localhost:8080');
      expect(agent).toBeDefined();
      expect(manager.hasAgent('http://localhost:8080')).toBe(true);
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
      });
    });

    it('should handle malformed URLs gracefully', () => {
      const agent = manager.getAgent('not-a-valid-url');
      expect(agent).toBeDefined();
    });
  });

  describe('configuration management', () => {
    it('should store agent configuration', () => {
      const config: AgentConfig = { connections: 50 };
      manager.getAgent('http://example.com', config);

      const storedConfig = manager.getAgentConfig('http://example.com');
      expect(storedConfig?.connections).toBe(50);
    });

    it('should merge configurations correctly', () => {
      const customManager = new AgentManager({ connections: 10 });
      const config: AgentConfig = { keepAliveTimeout: 2000 };

      customManager.getAgent('http://example.com', config);

      const storedConfig = customManager.getAgentConfig('http://example.com');
      expect(storedConfig?.connections).toBe(10); // from default
      expect(storedConfig?.keepAliveTimeout).toBe(2000); // from custom
    });

    it('should update agent configuration', async () => {
      manager.getAgent('http://example.com');
      const initialCount = manager.getAgentCount();

      const updated = manager.updateAgentConfig('http://example.com', {
        connections: 20,
      });

      expect(updated).toBe(true);
      expect(manager.getAgentCount()).toBe(initialCount);

      const config = manager.getAgentConfig('http://example.com');
      expect(config?.connections).toBe(20);
    });

    it('should return false when updating non-existent agent', () => {
      const updated = manager.updateAgentConfig('http://nonexistent.com', {
        connections: 20,
      });

      expect(updated).toBe(false);
    });
  });

  describe('agent lifecycle', () => {
    it('should close specific agent', async () => {
      manager.getAgent('http://example.com');
      expect(manager.getAgentCount()).toBe(1);

      await manager.closeAgent('http://example.com');
      expect(manager.getAgentCount()).toBe(0);
      expect(manager.hasAgent('http://example.com')).toBe(false);
    });

    it('should close all agents', async () => {
      manager.getAgent('http://example.com');
      manager.getAgent('http://api.example.com');
      expect(manager.getAgentCount()).toBe(2);

      await manager.closeAll();
      expect(manager.getAgentCount()).toBe(0);
    });

    it('should handle closing non-existent agent gracefully', async () => {
      await expect(
        manager.closeAgent('http://nonexistent.com'),
      ).resolves.not.toThrow();
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      manager.getAgent('http://example.com');
      manager.getAgent('http://api.example.com');

      const stats = manager.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.origins).toContain('http://example.com');
      expect(stats.origins).toContain('http://api.example.com');
      expect(stats.defaultConfig.connections).toBe(128);
    });
  });

  describe('default configuration updates', () => {
    it('should update default configuration', () => {
      const newConfig: AgentConfig = { connections: 50 };
      manager.setDefaultConfig(newConfig);

      const config = manager.getDefaultConfig();
      expect(config.connections).toBe(50);
    });

    it('should use new default for subsequent agents', () => {
      manager.setDefaultConfig({ connections: 25 });

      const agent = manager.getAgent('http://new.com');
      expect(agent).toBeDefined();

      const config = manager.getAgentConfig('http://new.com');
      expect(config?.connections).toBe(25);
    });
  });

  describe('clear functionality', () => {
    it('should clear all agents without closing', () => {
      manager.getAgent('http://example.com');
      manager.getAgent('http://api.example.com');
      expect(manager.getAgentCount()).toBe(2);

      manager.clear();
      expect(manager.getAgentCount()).toBe(0);
    });
  });
});

describe('createAgentManager', () => {
  it('should create new AgentManager with custom config', () => {
    const config: AgentConfig = { connections: 10 };
    const manager = createAgentManager(config);

    expect(manager).toBeInstanceOf(AgentManager);
    expect(manager.getDefaultConfig().connections).toBe(10);
  });

  it('should create new AgentManager with default config', () => {
    const manager = createAgentManager();

    expect(manager).toBeInstanceOf(AgentManager);
    expect(manager.getDefaultConfig().connections).toBe(128);
  });
});
