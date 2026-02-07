import { describe, expect, it } from 'vitest';

import { WorkerStateManager } from '../../../../src/workers/shared-memory/worker-state-manager';
import { WorkerState } from '../../../../src/workers/types';

describe('WorkerStateManager', () => {
  describe('constructor', () => {
    it('should initialize with correct number of workers', () => {
      const manager = new WorkerStateManager(5);

      expect(manager.getSharedBuffer()).toBeInstanceOf(SharedArrayBuffer);
    });

    it('should initialize all workers to INITIALIZING state', () => {
      const manager = new WorkerStateManager(4);

      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(1)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(2)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(3)).toBe(WorkerState.INITIALIZING);
    });

    it('should use external buffer when provided', () => {
      const maxWorkers = 5;
      const requiredSize = maxWorkers * 4;
      const externalBuffer = new SharedArrayBuffer(requiredSize);

      const manager = new WorkerStateManager(maxWorkers, externalBuffer);

      expect(manager.getSharedBuffer()).toBe(externalBuffer);
    });

    it('should throw error when external buffer is too small', () => {
      const smallBuffer = new SharedArrayBuffer(10);

      expect(() => new WorkerStateManager(5, smallBuffer)).toThrow(
        'Buffer too small: expected 20, got 10',
      );
    });

    it('should not initialize states when using external buffer', () => {
      const buffer = new SharedArrayBuffer(16);
      const view = new Int32Array(buffer);
      view[0] = WorkerState.RUNNING;
      view[1] = WorkerState.ERROR;
      view[2] = WorkerState.FINISHED;
      view[3] = WorkerState.PAUSED;

      const manager = new WorkerStateManager(4, buffer);

      expect(manager.getWorkerState(0)).toBe(WorkerState.RUNNING);
      expect(manager.getWorkerState(1)).toBe(WorkerState.ERROR);
      expect(manager.getWorkerState(2)).toBe(WorkerState.FINISHED);
      expect(manager.getWorkerState(3)).toBe(WorkerState.PAUSED);
    });
  });

  describe('setWorkerState', () => {
    it('should set worker state atomically', () => {
      const manager = new WorkerStateManager(5);

      manager.setWorkerState(2, WorkerState.READY);

      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(1)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(2)).toBe(WorkerState.READY);
      expect(manager.getWorkerState(3)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(4)).toBe(WorkerState.INITIALIZING);
    });

    it('should handle all worker states', () => {
      const manager = new WorkerStateManager(7);

      manager.setWorkerState(0, WorkerState.INITIALIZING);
      manager.setWorkerState(1, WorkerState.READY);
      manager.setWorkerState(2, WorkerState.RUNNING);
      manager.setWorkerState(3, WorkerState.PAUSED);
      manager.setWorkerState(4, WorkerState.FINISHED);
      manager.setWorkerState(5, WorkerState.ERROR);
      manager.setWorkerState(6, WorkerState.TERMINATED);

      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(1)).toBe(WorkerState.READY);
      expect(manager.getWorkerState(2)).toBe(WorkerState.RUNNING);
      expect(manager.getWorkerState(3)).toBe(WorkerState.PAUSED);
      expect(manager.getWorkerState(4)).toBe(WorkerState.FINISHED);
      expect(manager.getWorkerState(5)).toBe(WorkerState.ERROR);
      expect(manager.getWorkerState(6)).toBe(WorkerState.TERMINATED);
    });

    it('should throw error for invalid worker ID', () => {
      const manager = new WorkerStateManager(3);

      expect(() => manager.setWorkerState(-1, WorkerState.RUNNING)).toThrow(
        'Invalid worker ID: -1',
      );
      expect(() => manager.setWorkerState(3, WorkerState.RUNNING)).toThrow(
        'Invalid worker ID: 3',
      );
    });
  });

  describe('getWorkerState', () => {
    it('should return correct state for all workers', () => {
      const manager = new WorkerStateManager(4);

      manager.setWorkerState(1, WorkerState.RUNNING);
      manager.setWorkerState(3, WorkerState.ERROR);

      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(1)).toBe(WorkerState.RUNNING);
      expect(manager.getWorkerState(2)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(3)).toBe(WorkerState.ERROR);
    });

    it('should throw error for invalid worker ID', () => {
      const manager = new WorkerStateManager(3);

      expect(() => manager.getWorkerState(-1)).toThrow('Invalid worker ID: -1');
      expect(() => manager.getWorkerState(3)).toThrow('Invalid worker ID: 3');
    });
  });

  describe('state validation', () => {
    it('should validate all worker states are set correctly', () => {
      const manager = new WorkerStateManager(5);

      manager.setWorkerState(1, WorkerState.RUNNING);
      manager.setWorkerState(3, WorkerState.ERROR);
      manager.setWorkerState(4, WorkerState.FINISHED);

      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(1)).toBe(WorkerState.RUNNING);
      expect(manager.getWorkerState(2)).toBe(WorkerState.INITIALIZING);
      expect(manager.getWorkerState(3)).toBe(WorkerState.ERROR);
      expect(manager.getWorkerState(4)).toBe(WorkerState.FINISHED);
    });

    it('should handle single worker', () => {
      const manager = new WorkerStateManager(1);

      manager.setWorkerState(0, WorkerState.RUNNING);

      expect(manager.getWorkerState(0)).toBe(WorkerState.RUNNING);
    });
  });

  describe('waitForState', () => {
    it('should return true immediately if state already reached', () => {
      const manager = new WorkerStateManager(3);

      manager.setWorkerState(1, WorkerState.RUNNING);

      const result = manager.waitForState(1, WorkerState.RUNNING, 100);

      expect(result).toBe(true);
    });

    it('should return false if state not reached within timeout', () => {
      const manager = new WorkerStateManager(2);

      // Worker 0 stays in INITIALIZING state
      const result = manager.waitForState(0, WorkerState.RUNNING, 50);

      expect(result).toBe(false);
    });

    it('should handle zero timeout gracefully', () => {
      const manager = new WorkerStateManager(2);

      const result = manager.waitForState(0, WorkerState.RUNNING, 0);

      expect(result).toBe(false);
    });

    it('should handle very short timeout', () => {
      const manager = new WorkerStateManager(2);

      const result = manager.waitForState(0, WorkerState.RUNNING, 1);

      expect(result).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should handle typical worker lifecycle', () => {
      const manager = new WorkerStateManager(1);

      // Initial state
      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);

      // Ready for work
      manager.setWorkerState(0, WorkerState.READY);
      expect(manager.getWorkerState(0)).toBe(WorkerState.READY);

      // Running
      manager.setWorkerState(0, WorkerState.RUNNING);
      expect(manager.getWorkerState(0)).toBe(WorkerState.RUNNING);

      // Paused
      manager.setWorkerState(0, WorkerState.PAUSED);
      expect(manager.getWorkerState(0)).toBe(WorkerState.PAUSED);

      // Back to running
      manager.setWorkerState(0, WorkerState.RUNNING);
      expect(manager.getWorkerState(0)).toBe(WorkerState.RUNNING);

      // Finished successfully
      manager.setWorkerState(0, WorkerState.FINISHED);
      expect(manager.getWorkerState(0)).toBe(WorkerState.FINISHED);
    });

    it('should handle error state transition', () => {
      const manager = new WorkerStateManager(1);

      manager.setWorkerState(0, WorkerState.RUNNING);
      manager.setWorkerState(0, WorkerState.ERROR);

      expect(manager.getWorkerState(0)).toBe(WorkerState.ERROR);
    });

    it('should handle terminated state', () => {
      const manager = new WorkerStateManager(1);

      manager.setWorkerState(0, WorkerState.RUNNING);
      manager.setWorkerState(0, WorkerState.TERMINATED);

      expect(manager.getWorkerState(0)).toBe(WorkerState.TERMINATED);
    });
  });

  describe('atomic operations', () => {
    it('should handle concurrent state changes', () => {
      const manager = new WorkerStateManager(10);

      // Simulate rapid state changes
      const states = [
        WorkerState.INITIALIZING,
        WorkerState.READY,
        WorkerState.RUNNING,
        WorkerState.PAUSED,
        WorkerState.FINISHED,
        WorkerState.ERROR,
        WorkerState.TERMINATED,
      ];

      for (let i = 0; i < 100; i++) {
        const workerId = i % 10;
        const state = states[i % states.length];
        manager.setWorkerState(workerId, state);
      }

      // Verify all states are valid
      for (let i = 0; i < 10; i++) {
        const state = manager.getWorkerState(i);
        expect(Object.values(WorkerState)).toContain(state);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle single worker', () => {
      const manager = new WorkerStateManager(1);

      expect(manager.getWorkerState(0)).toBe(WorkerState.INITIALIZING);

      manager.setWorkerState(0, WorkerState.RUNNING);
      expect(manager.getWorkerState(0)).toBe(WorkerState.RUNNING);
    });

    it('should handle large number of workers', () => {
      const workerCount = 100;
      const manager = new WorkerStateManager(workerCount);

      // Set alternating states
      for (let i = 0; i < workerCount; i += 2) {
        manager.setWorkerState(i, WorkerState.RUNNING);
      }

      // Check alternating pattern
      for (let i = 0; i < workerCount; i++) {
        const expectedState =
          i % 2 === 0 ? WorkerState.RUNNING : WorkerState.INITIALIZING;
        expect(manager.getWorkerState(i)).toBe(expectedState);
      }
    });

    it('should handle maximum worker count', () => {
      // Test with a reasonable large number
      const maxWorkers = 1000;
      const manager = new WorkerStateManager(maxWorkers);

      // Set last worker to running
      manager.setWorkerState(maxWorkers - 1, WorkerState.RUNNING);
      expect(manager.getWorkerState(maxWorkers - 1)).toBe(WorkerState.RUNNING);
    });
  });

  describe('memory layout validation', () => {
    it('should have correct buffer size', () => {
      const workerCounts = [1, 5, 10, 50, 100];

      workerCounts.forEach((count) => {
        const manager = new WorkerStateManager(count);
        const buffer = manager.getSharedBuffer();

        expect(buffer.byteLength).toBe(count * 4);
      });
    });

    it('should maintain state consistency across multiple managers', () => {
      const maxWorkers = 5;
      const buffer = new SharedArrayBuffer(maxWorkers * 4);

      const manager1 = new WorkerStateManager(maxWorkers, buffer);
      const manager2 = new WorkerStateManager(maxWorkers, buffer);

      // Change state in first manager
      manager1.setWorkerState(2, WorkerState.RUNNING);

      // Second manager should see the change
      expect(manager2.getWorkerState(2)).toBe(WorkerState.RUNNING);
    });
  });
});
