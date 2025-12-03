import type {
  IEndpointStateManager,
  IStatsCounterManager,
  SafeTressiConfig,
} from 'tressi-common/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EarlyExitCoordinator } from '../../../src/workers/early-exit-coordinator';

describe('EarlyExitCoordinator', () => {
  let mockConfig: SafeTressiConfig;
  let mockStatsCounterManagers: IStatsCounterManager[];
  let mockEndpointStateManager: IEndpointStateManager;
  let coordinator: EarlyExitCoordinator;

  beforeEach(() => {
    // Mock config
    mockConfig = {
      $schema: 'http://example.com/schema.json',
      requests: [
        { url: 'http://example.com/api/1', method: 'GET' },
        { url: 'http://example.com/api/2', method: 'POST' },
        { url: 'http://example.com/api/3', method: 'PUT' },
      ],
      options: {
        durationSec: 60,
        workerEarlyExit: {
          enabled: true,
          perEndpointThresholds: [
            {
              url: 'http://example.com/api/1',
              errorRateThreshold: 0.5,
              errorCountThreshold: 10,
            },
            { url: 'http://example.com/api/2', errorRateThreshold: 0.3 },
          ],
          workerExitStatusCodes: [500, 502, 503],
          monitoringWindowMs: 100,
        },
      },
    } as SafeTressiConfig;

    // Mock stats counter managers
    mockStatsCounterManagers = [
      {
        getEndpointsCount: vi.fn().mockReturnValue(2),
        getEndpointCounters: vi.fn().mockReturnValue({
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        }),
        getAllEndpointCounters: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
        recordBytesSent: vi.fn(),
        recordBytesReceived: vi.fn(),
        deriveGlobalMetrics: vi.fn(),
      },
      {
        getEndpointsCount: vi.fn().mockReturnValue(1),
        getEndpointCounters: vi.fn().mockReturnValue({
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        }),
        getAllEndpointCounters: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
        recordBytesSent: vi.fn(),
        recordBytesReceived: vi.fn(),
        deriveGlobalMetrics: vi.fn(),
      },
    ];

    // Mock endpoint state manager
    mockEndpointStateManager = {
      isEndpointRunning: vi.fn().mockReturnValue(true),
      stopEndpoint: vi.fn(),
      getRunningEndpointsCount: vi.fn(),
      getTotalEndpoints: vi.fn(),
      getEndpointState: vi.fn(),
      setEndpointState: vi.fn(),
    };

    // Mock console output
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    if (coordinator) {
      coordinator.stopMonitoring();
    }
  });

  describe('constructor', () => {
    it('should initialize with disabled early exit when not configured', () => {
      const disabledConfig: SafeTressiConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [],
        options: {
          durationSec: 60,
          rampUpTimeSec: 0,
          headers: {},
          exportPath: null,
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.5,
            globalErrorCountThreshold: 10,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 100,
            stopMode: 'endpoint',
          },
        },
      };

      const disabledCoordinator = new EarlyExitCoordinator(
        disabledConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(disabledCoordinator).toBeInstanceOf(EarlyExitCoordinator);
    });

    it('should initialize with enabled early exit when configured', () => {
      coordinator = new EarlyExitCoordinator(
        mockConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(coordinator).toBeInstanceOf(EarlyExitCoordinator);
    });
  });

  describe('startMonitoring', () => {
    it('should not start monitoring when disabled', () => {
      const disabledConfig: SafeTressiConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [],
        options: {
          durationSec: 60,
          rampUpTimeSec: 0,
          headers: {},
          exportPath: null,
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.5,
            globalErrorCountThreshold: 10,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 100,
            stopMode: 'endpoint',
          },
        },
      };

      const disabledCoordinator = new EarlyExitCoordinator(
        disabledConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      disabledCoordinator.startMonitoring();

      // Verify no monitoring happens by checking that endpoints don't get stopped
      expect(mockEndpointStateManager.stopEndpoint).not.toHaveBeenCalled();
    });

    it('should start monitoring when enabled', () => {
      coordinator = new EarlyExitCoordinator(
        mockConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(() => coordinator.startMonitoring()).not.toThrow();

      // Clean up
      coordinator.stopMonitoring();
    });
  });

  describe('monitoring behavior', () => {
    beforeEach(() => {
      coordinator = new EarlyExitCoordinator(
        mockConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );
    });

    it('should identify endpoints to stop based on error rate threshold through monitoring', async () => {
      vi.mocked(
        mockStatsCounterManagers[0].getEndpointCounters,
      ).mockReturnValue({
        successCount: 5,
        failureCount: 5,
        bytesSent: 1000,
        bytesReceived: 2000,
        statusCodeCounts: {},
        sampledStatusCodes: [],
        bodySampleIndices: [],
      });

      coordinator.startMonitoring();

      // Wait for monitoring cycle to potentially trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      coordinator.stopMonitoring();

      // Verify that monitoring behavior occurred - may trigger based on thresholds
      // The actual verification happens through the side effects of monitoring
      // Allow for some calls as the behavior is now tested through public API
      expect(mockEndpointStateManager.stopEndpoint).toHaveBeenCalled();
    });

    it('should trigger early exit for endpoints exceeding thresholds', async () => {
      vi.mocked(
        mockStatsCounterManagers[0].getEndpointCounters,
      ).mockReturnValue({
        successCount: 1,
        failureCount: 10,
        bytesSent: 500,
        bytesReceived: 1000,
        statusCodeCounts: {},
        sampledStatusCodes: [],
        bodySampleIndices: [],
      });

      coordinator.startMonitoring();

      // Wait for monitoring to potentially trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      coordinator.stopMonitoring();

      // The behavior is verified through observable side effects
      // With high error rate (90%), expect endpoints to be stopped
      expect(mockEndpointStateManager.stopEndpoint).toHaveBeenCalled();
    });

    it('should handle stop monitoring gracefully', () => {
      coordinator = new EarlyExitCoordinator(
        mockConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      coordinator.startMonitoring();
      expect(() => coordinator.stopMonitoring()).not.toThrow();
    });

    it('should handle stop monitoring when not started', () => {
      coordinator = new EarlyExitCoordinator(
        mockConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(() => coordinator.stopMonitoring()).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should complete full monitoring lifecycle', async () => {
      vi.mocked(
        mockStatsCounterManagers[0].getEndpointCounters,
      ).mockReturnValue({
        successCount: 1,
        failureCount: 10,
        bytesSent: 800,
        bytesReceived: 1600,
        statusCodeCounts: {},
        sampledStatusCodes: [],
        bodySampleIndices: [],
      });

      coordinator = new EarlyExitCoordinator(
        mockConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      // Test the complete lifecycle through public APIs
      expect(() => {
        coordinator.startMonitoring();
        coordinator.stopMonitoring();
      }).not.toThrow();
    });
  });
});
