import { beforeEach, describe, expect, it } from 'vitest';

import { ConcurrencyCalculator } from '../../../src/workers/concurrency-calculator';

describe('ConcurrencyCalculator', () => {
  let calculator: ConcurrencyCalculator;

  beforeEach(() => {
    calculator = new ConcurrencyCalculator({
      targetRps: 100,
      maxWorkers: 10,
    });
  });

  describe('Initialization', () => {
    it('should initialize with provided config', () => {
      expect(calculator.getConfig()).toEqual({
        targetRps: 100,
        maxWorkers: 10,
        scaleUpThreshold: 0.9,
        scaleDownThreshold: 1.1,
        scaleFactor: 0.25,
        minWorkers: 1,
      });
    });

    it('should use custom thresholds', () => {
      const customCalculator = new ConcurrencyCalculator({
        targetRps: 200,
        maxWorkers: 20,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 1.2,
        scaleFactor: 0.5,
        minWorkers: 2,
      });

      expect(customCalculator.getConfig()).toEqual({
        targetRps: 200,
        maxWorkers: 20,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 1.2,
        scaleFactor: 0.5,
        minWorkers: 2,
      });
    });
  });

  describe('Worker Adjustment Calculations', () => {
    it('should recommend scale up when below threshold', () => {
      calculator.updateMetrics(80, 5); // 80 RPS with 5 workers

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_UP');
      expect(adjustment.workersToAdd).toBeGreaterThan(0);
      expect(adjustment.reason).toContain('below scale-up threshold');
    });

    it('should recommend scale down when above threshold', () => {
      calculator.updateMetrics(120, 8); // 120 RPS with 8 workers

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_DOWN');
      expect(adjustment.workersToRemove).toBeGreaterThan(0);
      expect(adjustment.reason).toContain('above scale-down threshold');
    });

    it('should recommend maintain when within thresholds', () => {
      calculator.updateMetrics(100, 5); // 100 RPS with 5 workers

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('MAINTAIN');
      expect(adjustment.reason).toContain('within thresholds');
    });

    it('should not scale up beyond max workers', () => {
      calculator.updateMetrics(80, 10); // 80 RPS with 10 workers (at max)

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('MAINTAIN');
    });

    it('should not scale down below min workers', () => {
      calculator.updateMetrics(120, 1); // 120 RPS with 1 worker (at min)

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('MAINTAIN');
    });
  });

  describe('Optimal Concurrency Calculation', () => {
    it('should calculate optimal concurrency for target RPS', () => {
      const concurrency = calculator.calculateOptimalConcurrency(25);

      expect(concurrency).toBe(25);
    });

    it('should handle zero target RPS', () => {
      const concurrency = calculator.calculateOptimalConcurrency(0);

      expect(concurrency).toBe(10);
    });

    it('should cap concurrency at 50', () => {
      const concurrency = calculator.calculateOptimalConcurrency(100);

      expect(concurrency).toBe(50);
    });

    it('should ensure minimum concurrency of 1', () => {
      const concurrency = calculator.calculateOptimalConcurrency(0.5);

      expect(concurrency).toBe(1);
    });
  });

  describe('Target RPS Per Worker Calculation', () => {
    it('should calculate target RPS per worker', () => {
      calculator.updateMetrics(100, 5);

      const rpsPerWorker = calculator.calculateTargetRpsPerWorker();

      expect(rpsPerWorker).toBe(20);
    });

    it('should handle zero workers', () => {
      calculator.updateMetrics(0, 0);

      const rpsPerWorker = calculator.calculateTargetRpsPerWorker();

      expect(rpsPerWorker).toBe(10); // targetRps / 10
    });

    it('should handle single worker', () => {
      calculator.updateMetrics(50, 1);

      const rpsPerWorker = calculator.calculateTargetRpsPerWorker();

      expect(rpsPerWorker).toBe(100);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      calculator.updateConfig({
        targetRps: 200,
        maxWorkers: 20,
      });

      const config = calculator.getConfig();
      expect(config.targetRps).toBe(200);
      expect(config.maxWorkers).toBe(20);
    });

    it('should emit config update event', () => {
      let eventEmitted = false;
      let receivedTargetRps: number | null = null;

      calculator.on('configUpdated', (config) => {
        eventEmitted = true;
        receivedTargetRps = (config as { targetRps: number }).targetRps;
      });

      calculator.updateConfig({ targetRps: 150 });

      expect(eventEmitted).toBe(true);
      expect(receivedTargetRps).toBe(150);
    });
  });

  describe('Metrics and Optimization', () => {
    it('should return current metrics', () => {
      calculator.updateMetrics(75, 5);

      const metrics = calculator.getMetrics();

      expect(metrics.currentRps).toBe(75);
      expect(metrics.currentWorkers).toBe(5);
      expect(metrics.targetRps).toBe(100);
      expect(metrics.utilization).toBe(75);
    });

    it('should determine if configuration is optimal', () => {
      calculator.updateMetrics(100, 5);

      expect(calculator.isConfigurationOptimal()).toBe(true);
    });

    it('should determine if configuration needs adjustment', () => {
      calculator.updateMetrics(80, 5);

      expect(calculator.isConfigurationOptimal()).toBe(false);
    });

    it('should handle zero target RPS in metrics', () => {
      const zeroCalculator = new ConcurrencyCalculator({
        targetRps: 0,
        maxWorkers: 10,
      });
      zeroCalculator.updateMetrics(0, 5);

      const metrics = zeroCalculator.getMetrics();

      expect(metrics.utilization).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very low RPS', () => {
      calculator.updateMetrics(1, 1);

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_UP');
    });

    it('should handle very high RPS', () => {
      calculator.updateMetrics(1000, 8);

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_DOWN');
    });

    it('should handle exact threshold values', () => {
      calculator.updateMetrics(90, 5); // Exactly at scale-up threshold

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('MAINTAIN');
    });

    it('should handle zero current workers', () => {
      calculator.updateMetrics(50, 0);

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_UP');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle web API scaling', () => {
      const apiCalculator = new ConcurrencyCalculator({
        targetRps: 500,
        maxWorkers: 20,
      });

      apiCalculator.updateMetrics(400, 8);

      const adjustment = apiCalculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_UP');
      expect(adjustment.workersToAdd).toBeGreaterThan(0);
    });

    it('should handle batch processing', () => {
      const batchCalculator = new ConcurrencyCalculator({
        targetRps: 50,
        maxWorkers: 10,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 1.2,
      });

      batchCalculator.updateMetrics(65, 5);

      const adjustment = batchCalculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_DOWN');
      expect(adjustment.workersToRemove).toBeGreaterThan(0);
    });

    it('should handle high-frequency trading', () => {
      const tradingCalculator = new ConcurrencyCalculator({
        targetRps: 10000,
        maxWorkers: 100,
        scaleFactor: 0.1,
      });

      tradingCalculator.updateMetrics(8000, 50);

      const adjustment = tradingCalculator.calculateWorkerAdjustment();

      expect(adjustment.action).toBe('SCALE_UP');
    });
  });

  describe('Adjustment Calculations', () => {
    it('should calculate correct workers to add', () => {
      calculator.updateMetrics(70, 5); // 30 RPS deficit

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.workersToAdd).toBe(1);
    });

    it('should calculate correct workers to remove', () => {
      calculator.updateMetrics(130, 8); // 30 RPS surplus

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.workersToRemove).toBe(1);
    });

    it('should provide detailed reasoning', () => {
      calculator.updateMetrics(85, 5);

      const adjustment = calculator.calculateWorkerAdjustment();

      expect(adjustment.reason).toContain('Current RPS (85.0)');
      expect(adjustment.reason).toContain('scale-up threshold (90.0)');
    });
  });
});
