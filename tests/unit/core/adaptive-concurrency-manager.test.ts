import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdaptiveConcurrencyManager } from '../../../src/core/adaptive-concurrency-manager';

describe('AdaptiveConcurrencyManager', () => {
  let manager: AdaptiveConcurrencyManager;

  beforeEach(() => {
    manager = new AdaptiveConcurrencyManager({
      maxConcurrency: 10,
      targetLatency: 100,
      memoryThreshold: 0.8,
      enableAdaptiveConcurrency: true,
      minConcurrency: 1,
    });
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(manager.getCurrentConcurrency()).toBe(5); // Half of maxConcurrency
    });

    it('should respect disabled adaptive concurrency', () => {
      const disabledManager = new AdaptiveConcurrencyManager({
        maxConcurrency: 10,
        targetLatency: 100,
        memoryThreshold: 0.8,
        enableAdaptiveConcurrency: false,
      });
      expect(disabledManager.getCurrentConcurrency()).toBe(10);
    });
  });

  describe('concurrency calculation', () => {
    it('should not adjust too frequently', async () => {
      const firstConcurrency = await manager.calculateOptimalConcurrency();
      const secondConcurrency = await manager.calculateOptimalConcurrency();

      // Should return same value due to adjustment interval
      expect(secondConcurrency).toBe(firstConcurrency);
    });

    it('should scale down on high latency', async () => {
      // Record high latencies
      for (let i = 0; i < 10; i++) {
        manager.recordLatency(200); // Above target
      }

      // Force adjustment by waiting
      vi.advanceTimersByTime(1100);

      const newConcurrency = await manager.calculateOptimalConcurrency();
      expect(newConcurrency).toBeLessThan(manager.getCurrentConcurrency());
    });

    it('should scale up on low latency', async () => {
      // Record low latencies
      for (let i = 0; i < 10; i++) {
        manager.recordLatency(50); // Below target
      }

      // Force adjustment by waiting
      vi.advanceTimersByTime(1100);

      const newConcurrency = await manager.calculateOptimalConcurrency();
      expect(newConcurrency).toBeGreaterThan(manager.getCurrentConcurrency());
    });

    it('should respect min and max bounds', async () => {
      // Try to scale below minimum
      for (let i = 0; i < 100; i++) {
        manager.recordLatency(1000);
      }

      vi.advanceTimersByTime(1100);
      const minConcurrency = await manager.calculateOptimalConcurrency();
      expect(minConcurrency).toBeGreaterThanOrEqual(1);

      // Reset and try to scale above maximum
      manager = new AdaptiveConcurrencyManager({
        maxConcurrency: 10,
        targetLatency: 100,
        memoryThreshold: 0.8,
        enableAdaptiveConcurrency: true,
        minConcurrency: 1,
      });

      for (let i = 0; i < 100; i++) {
        manager.recordLatency(10);
      }

      vi.advanceTimersByTime(1100);
      const maxConcurrency = await manager.calculateOptimalConcurrency();
      expect(maxConcurrency).toBeLessThanOrEqual(10);
    });
  });

  describe('metrics collection', () => {
    it('should collect system metrics', async () => {
      const metrics = await manager.getMetrics();

      expect(metrics).toHaveProperty('eventLoopLag');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('avgLatency');
    });
  });

  describe('configuration updates', () => {
    it('should update configuration dynamically', () => {
      manager.updateConfig({ maxConcurrency: 20 });
      expect(manager.getCurrentConcurrency()).toBeLessThanOrEqual(20);
    });

    it('should respect bounds after configuration update', () => {
      manager.updateConfig({ maxConcurrency: 5, minConcurrency: 3 });
      expect(manager.getCurrentConcurrency()).toBeGreaterThanOrEqual(3);
      expect(manager.getCurrentConcurrency()).toBeLessThanOrEqual(5);
    });
  });

  describe('reset functionality', () => {
    it('should reset to initial state', () => {
      manager.recordLatency(50);
      manager.updateConfig({ maxConcurrency: 20 });

      manager.reset();

      expect(manager.getCurrentConcurrency()).toBe(10); // Half of new max
    });
  });
});
