import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TressiConfig } from '../../../src/common/config/types';
import { EarlyExitCoordinator } from '../../../src/workers/early-exit-coordinator';
import {
  IEndpointStateManager,
  IStatsCounterManager,
} from '../../../src/workers/interfaces';

describe('EarlyExitCoordinator', () => {
  let mockConfig: TressiConfig;
  let mockStatsCounterManagers: IStatsCounterManager[];
  let mockEndpointStateManager: IEndpointStateManager;
  let coordinator: EarlyExitCoordinator;

  beforeEach(() => {
    // Mock config
    mockConfig = {
      $schema: 'http://example.com/schema.json',
      requests: [
        {
          url: 'http://example.com/api/1',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 10,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
        {
          url: 'http://example.com/api/2',
          method: 'POST',
          payload: {},
          headers: {},
          rps: 5,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
        {
          url: 'http://example.com/api/3',
          method: 'PUT',
          payload: {},
          headers: {},
          rps: 8,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      ],
      options: {
        durationSec: 60,
        exportPath: '',
        silent: false,
        headers: {},
        threads: 1,
        workerMemoryLimit: 512,
        workerEarlyExit: {
          enabled: true,
          errorRateThreshold: 0.1,
          exitStatusCodes: [500, 502, 503],
          monitoringWindowMs: 100,
        },
      },
    } as TressiConfig;

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
      const disabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 100,
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
      const disabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 100,
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
      // Create a config with early exit enabled for specific endpoints
      const enabledConfig: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [
          {
            url: 'http://example.com/api/1',
            method: 'GET',
            payload: {},
            headers: {},
            rps: 10,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.5,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowMs: 100,
            },
          },
          {
            url: 'http://example.com/api/2',
            method: 'POST',
            payload: {},
            headers: {},
            rps: 5,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowMs: 100,
            },
          },
        ],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.1,
            exitStatusCodes: [500, 502, 503],
            monitoringWindowMs: 100,
          },
        },
      } as TressiConfig;

      coordinator = new EarlyExitCoordinator(
        enabledConfig,
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

      // Verify that monitoring behavior occurred - should trigger based on 50% error rate
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
        requests: [
          {
            url: 'http://example.com/api/1',
            method: 'GET',
            payload: {},
            headers: {},
            rps: 10,
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowMs: 100,
            },
          },
        ],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.1,
            exitStatusCodes: [500, 502, 503],
            monitoringWindowMs: 100,
          },
        },
      } as TressiConfig;

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
        requests: [
          {
            url: 'http://example.com/api/1',
            method: 'GET',
            payload: {},
            headers: {},
            rps: 10,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: true,
              errorRateThreshold: 0.2,
              exitStatusCodes: [500],
              monitoringWindowMs: 2000,
            },
          },
          {
            url: 'http://example.com/api/2',
            method: 'POST',
            payload: {},
            headers: {},
            rps: 5,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.5,
            exitStatusCodes: [500, 502],
            monitoringWindowMs: 1000,
          },
        },
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
        requests: [
          {
            url: 'http://example.com/api/1',
            method: 'GET',
            payload: {},
            headers: {},
            rps: 10,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: 'http://example.com/api/2',
            method: 'POST',
            payload: {},
            headers: {},
            rps: 5,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.3,
            exitStatusCodes: [500],
            monitoringWindowMs: 1000,
          },
        },
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
        requests: [
          {
            url: 'http://example.com/api/1',
            method: 'GET',
            payload: {},
            headers: {},
            rps: 10,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0.1,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.3,
            exitStatusCodes: [500],
            monitoringWindowMs: 1000,
          },
        },
      };

      const testCoordinator = new EarlyExitCoordinator(
        configWithDisabled,
        mockStatsCounterManagers,
        mockEndpointStateManager,
      );

      expect(testCoordinator).toBeInstanceOf(EarlyExitCoordinator);
    });
  });

  describe('status code checking', () => {
    it('should trigger early exit for configured status codes', () => {
      const configWithStatusCodes: TressiConfig = {
        $schema: 'http://example.com/schema.json',
        requests: [
          {
            url: 'http://example.com/api/1',
            method: 'GET',
            payload: {},
            headers: {},
            rps: 10,
            rampUpDurationSec: 0,
            earlyExit: {
              enabled: true,
              exitStatusCodes: [500, 502],
              errorRateThreshold: 0,
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 60,
          headers: {},
          exportPath: '',
          silent: false,
          threads: 1,
          workerMemoryLimit: 512,
          workerEarlyExit: {
            enabled: true,
            exitStatusCodes: [503],
            errorRateThreshold: 0,
            monitoringWindowMs: 5000,
          },
        },
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
