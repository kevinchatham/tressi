import { EndpointState } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { EndpointStateManager } from './endpoint-state-manager';

describe('EndpointStateManager', () => {
  describe('constructor', () => {
    it('should initialize with correct number of endpoints', () => {
      const manager = new EndpointStateManager(5);

      expect(manager.getTotalEndpoints()).toBe(5);
      expect(manager.getSharedBuffer()).toBeInstanceOf(SharedArrayBuffer);
    });

    it('should initialize all endpoints to RUNNING state', () => {
      const manager = new EndpointStateManager(3);

      expect(manager.getEndpointState(0)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(1)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(2)).toBe(EndpointState.RUNNING);
    });

    it('should use external buffer when provided', () => {
      const totalEndpoints = 4;
      const requiredSize = totalEndpoints * 4;
      const externalBuffer = new SharedArrayBuffer(requiredSize);

      const manager = new EndpointStateManager(totalEndpoints, externalBuffer);

      expect(manager.getSharedBuffer()).toBe(externalBuffer);
      expect(manager.getTotalEndpoints()).toBe(totalEndpoints);
    });

    it('should throw error when external buffer is too small', () => {
      const smallBuffer = new SharedArrayBuffer(10);

      expect(() => new EndpointStateManager(5, smallBuffer)).toThrow(
        'Buffer too small: expected 20, got 10',
      );
    });

    it('should not initialize states when using external buffer', () => {
      const buffer = new SharedArrayBuffer(12);
      const view = new Int32Array(buffer);
      view[0] = EndpointState.STOPPED;
      view[1] = EndpointState.ERROR;
      view[2] = EndpointState.RUNNING;

      const manager = new EndpointStateManager(3, buffer);

      expect(manager.getEndpointState(0)).toBe(EndpointState.STOPPED);
      expect(manager.getEndpointState(1)).toBe(EndpointState.ERROR);
      expect(manager.getEndpointState(2)).toBe(EndpointState.RUNNING);
    });
  });

  describe('setEndpointState', () => {
    it('should set endpoint state atomically', () => {
      const manager = new EndpointStateManager(3);

      manager.setEndpointState(1, EndpointState.STOPPED);

      expect(manager.getEndpointState(0)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(1)).toBe(EndpointState.STOPPED);
      expect(manager.getEndpointState(2)).toBe(EndpointState.RUNNING);
    });

    it('should set ERROR state', () => {
      const manager = new EndpointStateManager(2);

      manager.setEndpointState(0, EndpointState.ERROR);

      expect(manager.getEndpointState(0)).toBe(EndpointState.ERROR);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new EndpointStateManager(3);

      expect(() => manager.setEndpointState(-1, EndpointState.STOPPED)).toThrow(
        'Invalid endpoint index: -1',
      );
      expect(() => manager.setEndpointState(3, EndpointState.STOPPED)).toThrow(
        'Invalid endpoint index: 3',
      );
    });
  });

  describe('getEndpointState', () => {
    it('should return correct state for all endpoints', () => {
      const manager = new EndpointStateManager(4);

      const states = [];
      for (let i = 0; i < 4; i++) {
        states.push(manager.getEndpointState(i));
      }

      expect(states).toEqual([
        EndpointState.RUNNING,
        EndpointState.RUNNING,
        EndpointState.RUNNING,
        EndpointState.RUNNING,
      ]);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new EndpointStateManager(3);

      expect(() => manager.getEndpointState(-1)).toThrow('Invalid endpoint index: -1');
      expect(() => manager.getEndpointState(3)).toThrow('Invalid endpoint index: 3');
    });
  });

  describe('isEndpointRunning', () => {
    it('should return true for RUNNING state', () => {
      const manager = new EndpointStateManager(2);

      expect(manager.isEndpointRunning(0)).toBe(true);
    });

    it('should return false for STOPPED state', () => {
      const manager = new EndpointStateManager(2);

      manager.setEndpointState(0, EndpointState.STOPPED);

      expect(manager.isEndpointRunning(0)).toBe(false);
    });

    it('should return false for ERROR state', () => {
      const manager = new EndpointStateManager(2);

      manager.setEndpointState(0, EndpointState.ERROR);

      expect(manager.isEndpointRunning(0)).toBe(false);
    });
  });

  describe('stopEndpoint', () => {
    it('should set endpoint to STOPPED state', () => {
      const manager = new EndpointStateManager(3);

      manager.stopEndpoint(1);

      expect(manager.getEndpointState(0)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(1)).toBe(EndpointState.STOPPED);
      expect(manager.getEndpointState(2)).toBe(EndpointState.RUNNING);
    });

    it('should be idempotent', () => {
      const manager = new EndpointStateManager(2);

      manager.stopEndpoint(0);
      manager.stopEndpoint(0);

      expect(manager.getEndpointState(0)).toBe(EndpointState.STOPPED);
    });
  });

  describe('error state handling', () => {
    it('should set endpoint to ERROR state using setEndpointState', () => {
      const manager = new EndpointStateManager(3);

      manager.setEndpointState(2, EndpointState.ERROR);

      expect(manager.getEndpointState(0)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(1)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(2)).toBe(EndpointState.ERROR);
    });

    it('should be idempotent when setting ERROR state', () => {
      const manager = new EndpointStateManager(2);

      manager.setEndpointState(0, EndpointState.ERROR);
      manager.setEndpointState(0, EndpointState.ERROR);

      expect(manager.getEndpointState(0)).toBe(EndpointState.ERROR);
    });
  });

  describe('endpoint state validation', () => {
    it('should validate all endpoint states are set correctly', () => {
      const manager = new EndpointStateManager(4);

      manager.setEndpointState(1, EndpointState.STOPPED);
      manager.setEndpointState(3, EndpointState.ERROR);

      expect(manager.getEndpointState(0)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(1)).toBe(EndpointState.STOPPED);
      expect(manager.getEndpointState(2)).toBe(EndpointState.RUNNING);
      expect(manager.getEndpointState(3)).toBe(EndpointState.ERROR);
    });

    it('should handle zero endpoints', () => {
      const manager = new EndpointStateManager(0);

      expect(manager.getTotalEndpoints()).toBe(0);
      expect(manager.getRunningEndpointsCount()).toBe(0);
    });
  });

  describe('getRunningEndpointsCount', () => {
    it('should return correct count of running endpoints', () => {
      const manager = new EndpointStateManager(5);

      expect(manager.getRunningEndpointsCount()).toBe(5);

      manager.setEndpointState(1, EndpointState.STOPPED);
      manager.setEndpointState(3, EndpointState.ERROR);

      expect(manager.getRunningEndpointsCount()).toBe(3);
    });

    it('should return zero when no endpoints are running', () => {
      const manager = new EndpointStateManager(3);

      manager.setEndpointState(0, EndpointState.STOPPED);
      manager.setEndpointState(1, EndpointState.ERROR);
      manager.setEndpointState(2, EndpointState.STOPPED);

      expect(manager.getRunningEndpointsCount()).toBe(0);
    });
  });

  describe('atomic operations', () => {
    it('should handle concurrent state changes', () => {
      const manager = new EndpointStateManager(10);

      // Simulate concurrent access by rapidly changing states
      for (let i = 0; i < 100; i++) {
        const endpoint = i % 10;
        const state =
          i % 3 === 0
            ? EndpointState.STOPPED
            : i % 3 === 1
              ? EndpointState.ERROR
              : EndpointState.RUNNING;
        manager.setEndpointState(endpoint, state);
      }

      // All states should be consistent
      for (let i = 0; i < 10; i++) {
        const state = manager.getEndpointState(i);
        expect([EndpointState.RUNNING, EndpointState.STOPPED, EndpointState.ERROR]).toContain(
          state,
        );
      }
    });
  });

  describe('edge cases', () => {
    it('should handle single endpoint', () => {
      const manager = new EndpointStateManager(1);

      expect(manager.getTotalEndpoints()).toBe(1);
      expect(manager.getEndpointState(0)).toBe(EndpointState.RUNNING);
      expect(manager.getRunningEndpointsCount()).toBe(1);
    });

    it('should handle large number of endpoints', () => {
      const endpointCount = 1000;
      const manager = new EndpointStateManager(endpointCount);

      expect(manager.getTotalEndpoints()).toBe(endpointCount);

      // All should be running initially
      expect(manager.getRunningEndpointsCount()).toBe(endpointCount);

      // Stop every other endpoint
      for (let i = 0; i < endpointCount; i += 2) {
        manager.setEndpointState(i, EndpointState.STOPPED);
      }

      expect(manager.getRunningEndpointsCount()).toBe(endpointCount / 2);
    });
  });
});
