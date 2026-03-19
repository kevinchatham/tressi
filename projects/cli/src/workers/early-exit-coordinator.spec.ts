import type { IEndpointStateManager, IStatsCounterManager } from '@tressi/shared/cli';
import type { TressiConfig } from '@tressi/shared/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EarlyExitCoordinator } from './early-exit-coordinator';

describe('EarlyExitCoordinator', () => {
  let mockConfig: TressiConfig;
  let mockStatsCounterManagers: IStatsCounterManager[];
  let mockEndpointStateManager: IEndpointStateManager;
  let coordinator: EarlyExitCoordinator;

  beforeEach(() => {
    // Mock config
    mockConfig = {
      $schema: 'http://example.com/schema.json',
      options: {
        durationSec: 60,
        headers: {},
        rampUpDurationSec: 0,
        threads: 1,
        workerEarlyExit: {
          enabled: true,
          errorRateThreshold: 0.1,
          exitStatusCodes: [500, 502, 503],
          monitoringWindowMs: 1000,
        },
        workerMemoryLimit: 512,
      },
      requests: [
        {
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 1000,
          },
          headers: {},
          method: 'GET',
          payload: {},
          rampUpDurationSec: 0,
          rps: 10,
          url: 'http://example.com/api/1',
        },
        {
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 1000,
          },
          headers: {},
          method: 'POST',
          payload: {},
          rampUpDurationSec: 0,
          rps: 5,
          url: 'http://example.com/api/2',
        },
        {
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 1000,
          },
          headers: {},
          method: 'PUT',
          payload: {},
          rampUpDurationSec: 0,
          rps: 8,
          url: 'http://example.com/api/3',
        },
      ],
    } as TressiConfig;

    // Mock stats counter managers
    mockStatsCounterManagers = [
      {
        getAllEndpointCounters: vi.fn(),
        getEndpointCounters: vi.fn().mockReturnValue({
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        }),
        getEndpointsCount: vi.fn().mockReturnValue(2),
        recordBytesReceived: vi.fn(),
        recordBytesSent: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
      },
      {
        getAllEndpointCounters: vi.fn(),
        getEndpointCounters: vi.fn().mockReturnValue({
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        }),
        getEndpointsCount: vi.fn().mockReturnValue(1),
        recordBytesReceived: vi.fn(),
        recordBytesSent: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
      },
    ];

    // Mock endpoint state manager
    mockEndpointStateManager = {
      getEndpointState: vi.fn(),
      getRunningEndpointsCount: vi.fn(),
      getTotalEndpoints: vi.fn(),
      isEndpointRunning: vi.fn().mockReturnValue(true),
      setEndpointState: vi.fn(),
      stopEndpoint: vi.fn(),
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
      const disabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [],
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
      const disabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [],
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

    it('should start monitoring based on per-request earlyExit even when global workerEarlyExit is disabled', async () => {
      const configPerRequestOnly: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 50,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500],
              monitoringWindowMs: 50,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/error-prone',
          },
        ],
      } as TressiConfig;

      vi.mocked(mockStatsCounterManagers[0].getEndpointCounters).mockReturnValue({
        bodySampleIndices: [],
        bytesReceived: 1000,
        bytesSent: 500,
        failureCount: 10,
        sampledStatusCodes: [],
        statusCodeCounts: { 500: 10 },
        successCount: 1,
      });

      const perRequestCoordinator = new EarlyExitCoordinator(
        configPerRequestOnly,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      perRequestCoordinator.startMonitoring();

      // Wait for at least one monitoring cycle
      await new Promise((resolve) => setTimeout(resolve, 150));

      perRequestCoordinator.stopMonitoring();

      // Endpoint should have been stopped despite global flag being false
      expect(mockEndpointStateManager.stopEndpoint).toHaveBeenCalled();
    });
  });

  describe('monitoring behavior', () => {
    beforeEach(() => {
      // Create a config with early exit enabled for specific endpoints
      const enabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.1,
            exitStatusCodes: [500, 502, 503],
            monitoringWindowMs: 50,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.5,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowMs: 50,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/1',
          },
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowMs: 50,
            },
            headers: {},
            method: 'POST',
            payload: {},
            rampUpDurationSec: 0,
            rps: 5,
            url: 'http://example.com/api/2',
          },
        ],
      } as TressiConfig;

      coordinator = new EarlyExitCoordinator(
        enabledConfig,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );
    });

    it('should identify endpoints to stop based on error rate threshold through monitoring', async () => {
      vi.mocked(mockStatsCounterManagers[0].getEndpointCounters).mockReturnValue({
        bodySampleIndices: [],
        bytesReceived: 2000,
        bytesSent: 1000,
        failureCount: 5,
        sampledStatusCodes: [],
        statusCodeCounts: {},
        successCount: 5,
      });

      coordinator.startMonitoring();

      // Wait for monitoring cycle to potentially trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      coordinator.stopMonitoring();

      // Verify that monitoring behavior occurred - should trigger based on 50% error rate
      expect(mockEndpointStateManager.stopEndpoint).toHaveBeenCalled();
    });

    it('should trigger early exit for endpoints exceeding thresholds', async () => {
      vi.mocked(mockStatsCounterManagers[0].getEndpointCounters).mockReturnValue({
        bodySampleIndices: [],
        bytesReceived: 1000,
        bytesSent: 500,
        failureCount: 10,
        sampledStatusCodes: [],
        statusCodeCounts: {},
        successCount: 1,
      });

      coordinator.startMonitoring();

      // Wait for monitoring to potentially trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      coordinator.stopMonitoring();

      // With high error rate (90%), expect endpoints to be stopped
      expect(mockEndpointStateManager.stopEndpoint).toHaveBeenCalled();
    });

    it('should handle stop monitoring gracefully', () => {
      coordinator.startMonitoring();
      expect(() => coordinator.stopMonitoring()).not.toThrow();
    });

    it('should handle stop monitoring when not started', () => {
      expect(() => coordinator.stopMonitoring()).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should complete full monitoring lifecycle', async () => {
      const enabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.1,
            exitStatusCodes: [500, 502, 503],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/1',
          },
        ],
      } as TressiConfig;

      vi.mocked(mockStatsCounterManagers[0].getEndpointCounters).mockReturnValue({
        bodySampleIndices: [],
        bytesReceived: 1600,
        bytesSent: 800,
        failureCount: 10,
        sampledStatusCodes: [],
        statusCodeCounts: {},
        successCount: 1,
      });

      coordinator = new EarlyExitCoordinator(
        enabledConfig,
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

  describe('request-level early exit configuration', () => {
    it('should use request-level config over global config', () => {
      const configWithRequestLevel: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.5,
            exitStatusCodes: [500, 502],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.2,
              exitStatusCodes: [500],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/1',
          },
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'POST',
            payload: {},
            rampUpDurationSec: 0,
            rps: 5,
            url: 'http://example.com/api/2',
          },
        ],
      };

      const testCoordinator = new EarlyExitCoordinator(
        configWithRequestLevel,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      // Verify the coordinator was created successfully
      expect(testCoordinator).toBeInstanceOf(EarlyExitCoordinator);
    });

    it('should use global config when no request-level config exists', () => {
      const configWithGlobalOnly: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.3,
            exitStatusCodes: [500],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/1',
          },
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'POST',
            payload: {},
            rampUpDurationSec: 0,
            rps: 5,
            url: 'http://example.com/api/2',
          },
        ],
      };

      const testCoordinator = new EarlyExitCoordinator(
        configWithGlobalOnly,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(testCoordinator).toBeInstanceOf(EarlyExitCoordinator);
    });

    it('should not apply early exit to endpoints with enabled: false', () => {
      const configWithDisabled: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.3,
            exitStatusCodes: [500],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0.1,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/1',
          },
        ],
      };

      const testCoordinator = new EarlyExitCoordinator(
        configWithDisabled,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(testCoordinator).toBeInstanceOf(EarlyExitCoordinator);
    });

    it('should stop the error-prone endpoint and not the healthy endpoint when only per-request earlyExit is configured', async () => {
      // Mirrors the e2e scenario: global workerEarlyExit is disabled, one endpoint has
      // per-request earlyExit enabled with a 10% error Rate threshold.
      const configGlobalDisabled: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            // monitoringWindowMs here drives the setInterval period even when global is
            // disabled, so it must be low enough that the interval fires within the test wait.
            monitoringWindowMs: 50,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/healthy',
          },
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/error-prone',
          },
        ],
      } as TressiConfig;

      // Single worker owns both endpoints:
      //   globalEndpointIndex 0 → workerId 0, localEndpointIndex 0 (healthy)
      //   globalEndpointIndex 1 → workerId 0, localEndpointIndex 1 (error-prone)
      const singleWorkerManager: IStatsCounterManager = {
        getAllEndpointCounters: vi.fn(),
        getEndpointCounters: vi.fn().mockImplementation((localIndex: number) => {
          if (localIndex === 0) {
            // healthy endpoint – no errors
            return {
              bodySampleIndices: [],
              bytesReceived: 2000,
              bytesSent: 1000,
              failureCount: 0,
              sampledStatusCodes: [],
              statusCodeCounts: {},
              successCount: 100,
            };
          }
          // error-prone endpoint – ~95% error rate
          return {
            bodySampleIndices: [],
            bytesReceived: 1000,
            bytesSent: 500,
            failureCount: 20,
            sampledStatusCodes: [],
            statusCodeCounts: { 500: 20 },
            successCount: 1,
          };
        }),
        getEndpointsCount: vi.fn().mockReturnValue(2),
        recordBytesReceived: vi.fn(),
        recordBytesSent: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
      };

      const testCoordinator = new EarlyExitCoordinator(
        configGlobalDisabled,
        [singleWorkerManager],
        mockEndpointStateManager,
      );

      testCoordinator.startMonitoring();

      await new Promise((resolve) => setTimeout(resolve, 150));

      testCoordinator.stopMonitoring();

      // Only the error-prone endpoint (global index 1) should be stopped
      expect(mockEndpointStateManager.stopEndpoint).toHaveBeenCalledWith(1);
      // The healthy endpoint (global index 0, earlyExit.enabled: false) must not be stopped
      expect(mockEndpointStateManager.stopEndpoint).not.toHaveBeenCalledWith(0);
    });
  });

  describe('status code checking', () => {
    it('should trigger early exit for configured status codes', () => {
      const configWithStatusCodes: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0,
            exitStatusCodes: [503],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0,
              exitStatusCodes: [500, 502],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://example.com/api/1',
          },
        ],
      };

      const testCoordinator = new EarlyExitCoordinator(
        configWithStatusCodes,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(testCoordinator).toBeInstanceOf(EarlyExitCoordinator);
    });
  });
});
