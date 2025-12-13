import type { TressiConfig } from 'tressi-common/config';

import {
  IEarlyExitCoordinator,
  IEndpointStateManager,
  IStatsCounterManager,
} from '../types/workers/interfaces';
import { EarlyExitThresholds } from '../types/workers/types';

/**
 * EarlyExitCoordinator - Monitors test execution and triggers early termination based on configurable thresholds.
 *
 * This class implements intelligent test termination by continuously monitoring error rates and error counts
 * per endpoint. It can stop individual endpoints or the entire test when conditions exceed configured thresholds,
 * preventing wasted resources and providing faster feedback on failing endpoints.
 *
 * @example
 * ```typescript
 * const coordinator = new EarlyExitCoordinator(config, statsManagers, endpointStateManager);
 * coordinator.startMonitoring();
 * // Monitoring runs automatically until stopMonitoring() is called
 * coordinator.stopMonitoring();
 * ```
 *
 * @remarks
 * The coordinator uses a monitoring window approach where thresholds are evaluated over sliding time windows.
 * This prevents false positives from temporary spikes while maintaining responsiveness to genuine problems.
 * Supports both per-endpoint and global (all endpoints combined) threshold configurations.
 */
export class EarlyExitCoordinator implements IEarlyExitCoordinator {
  private thresholds: EarlyExitThresholds;
  private monitoringInterval?: NodeJS.Timeout;
  constructor(
    private config: TressiConfig,
    private statsCounterManagers: IStatsCounterManager[],
    private endpointStateManager: IEndpointStateManager,
  ) {
    this.thresholds = this.parseThresholds();
  }

  /**
   * Parses early exit configuration from the main test config.
   *
   * @returns Parsed threshold configuration including per-endpoint limits and monitoring window
   *
   * @remarks
   * Extracts threshold values from the config's workerEarlyExit section and request-level configs.
   * Implements precedence: request-level > global fallback.
   * If early exit is disabled, returns a configuration with empty thresholds.
   *
   * @throws {Error} If configuration parsing fails due to invalid data types
   */
  private parseThresholds(): EarlyExitThresholds {
    const globalExitConfig = this.config.options.workerEarlyExit;

    if (!globalExitConfig?.enabled) {
      return {
        perEndpoint: new Map(),
        monitoringWindowMs: 5000,
      };
    }

    const perEndpointMap = new Map();
    const globalMonitoringWindow = globalExitConfig.monitoringWindowMs || 5000;

    // Process each endpoint to determine its effective early exit config
    this.config.requests.forEach((request) => {
      // Precedence: request-level > global defaults
      const requestConfig = request.earlyExit;

      if (requestConfig?.enabled) {
        // Use request-level configuration
        perEndpointMap.set(request.url, {
          errorRate: requestConfig.errorRateThreshold,
          exitStatusCodes: new Set(
            requestConfig.exitStatusCodes || [500, 502, 503, 504],
          ),
          monitoringWindowMs:
            requestConfig.monitoringWindowMs || globalMonitoringWindow,
        });
      } else if (globalExitConfig.enabled) {
        // Use global configuration as fallback
        // Only apply if endpoint has no request-level config or it's disabled
        const hasRequestConfig = requestConfig !== undefined;

        if (!hasRequestConfig) {
          // Endpoint has no early exit config, use global defaults
          perEndpointMap.set(request.url, {
            errorRate: globalExitConfig.errorRateThreshold,
            exitStatusCodes: new Set(globalExitConfig.exitStatusCodes),
            monitoringWindowMs: globalMonitoringWindow,
          });
        }
        // If requestConfig.enabled is false, don't add to map (endpoint won't have early exit)
      }
    });

    return {
      perEndpoint: perEndpointMap,
      monitoringWindowMs: globalMonitoringWindow,
    };
  }

  /**
   * Starts the early exit monitoring process.
   *
   * @remarks
   * Begins periodic evaluation of early exit conditions based on the configured monitoring window.
   * If early exit is disabled in configuration, this method returns immediately without starting monitoring.
   * The monitoring interval is determined by the monitoringWindowMs configuration parameter.
   */
  startMonitoring(): void {
    if (!this.config.options.workerEarlyExit?.enabled) return;

    this.monitoringInterval = setInterval(() => {
      this.checkEarlyExitConditions();
    }, this.thresholds.monitoringWindowMs);
  }

  /**
   * Evaluates early exit conditions across all endpoints.
   *
   * @remarks
   * This method is called periodically during monitoring to check if any endpoints
   * should be stopped due to threshold violations. It aggregates error metrics
   * across workers and compares them against configured thresholds.
   *
   * When endpoints exceed thresholds, they are added to a stop list and terminated
   * individually, allowing the rest of the test to continue. This provides granular
   * control over test execution and resource usage.
   */
  private checkEarlyExitConditions(): void {
    const endpointsToStop = this.getEndpointsToStop();
    if (endpointsToStop.length > 0) {
      this.triggerEndpointEarlyExit(endpointsToStop);
    }
  }

  /**
   * Identifies endpoints that should be stopped due to threshold violations.
   *
   * @returns Array of endpoint URLs that exceed configured thresholds
   *
   * @remarks
   * Evaluates each endpoint individually against its configured thresholds:
   * - Error rate threshold: percentage of failed requests
   * - Error count threshold: absolute number of failed requests
   * - Status code thresholds: specific HTTP status codes that trigger immediate stop
   *
   * Only endpoints with configured thresholds are evaluated. The method aggregates
   * error counts and status codes across all workers that handle the endpoint.
   *
   * @example
   * ```typescript
   * // With thresholds: { errorRate: 0.5, errorCount: 100 }
   * // If endpoint has 60 failures out of 100 requests (60% error rate)
   * // This endpoint would be added to the stop list
   * ```
   */
  private getEndpointsToStop(): string[] {
    const endpoints: string[] = [];

    // Check each endpoint across all workers
    this.config.requests.forEach((request, globalEndpointIndex) => {
      // Skip if endpoint is already stopped
      if (!this.endpointStateManager.isEndpointRunning(globalEndpointIndex)) {
        return;
      }

      const threshold = this.thresholds.perEndpoint.get(request.url);
      if (!threshold) return;

      let endpointTotalRequests = 0;
      let endpointTotalErrors = 0;
      let statusCodeCounts: Record<number, number> = {};

      // Find which worker owns this endpoint
      const workerId = globalEndpointIndex % this.statsCounterManagers.length;
      const localEndpointIndex = Math.floor(
        globalEndpointIndex / this.statsCounterManagers.length,
      );

      if (workerId < this.statsCounterManagers.length) {
        const manager = this.statsCounterManagers[workerId];
        if (localEndpointIndex < manager.getEndpointsCount()) {
          const counters = manager.getEndpointCounters(localEndpointIndex);
          endpointTotalRequests = counters.successCount + counters.failureCount;
          endpointTotalErrors = counters.failureCount;
          statusCodeCounts = counters.statusCodeCounts || {};
        }
      }

      if (endpointTotalRequests === 0) return;

      const errorRate = endpointTotalErrors / endpointTotalRequests;

      // Check error rate threshold
      if (threshold.errorRate && errorRate >= threshold.errorRate) {
        endpoints.push(request.url);
        return;
      }

      // Check error count threshold
      if (threshold.errorCount && endpointTotalErrors >= threshold.errorCount) {
        endpoints.push(request.url);
        return;
      }

      // Check status code thresholds
      threshold.exitStatusCodes.forEach((statusCode) => {
        if (statusCodeCounts[statusCode] > 0) {
          endpoints.push(request.url);
          return;
        }
      });
    });

    return endpoints;
  }

  /**
   * Triggers early exit for specific endpoints by stopping their execution.
   *
   * @param endpoints - Array of endpoint URLs to stop
   *
   * @remarks
   * Stops individual endpoints rather than terminating the entire test.
   * This allows other endpoints to continue running, providing more granular
   * control over test execution and better resource utilization.
   *
   * Updates the endpoint state in shared memory to mark endpoints as stopped,
   * which workers check before executing requests.
   */
  private triggerEndpointEarlyExit(endpoints: string[]): void {
    process.stdout.write(
      `🚨 Endpoint early exit triggered for: ${endpoints.join(', ')}\n`,
    );

    // Stop individual endpoints instead of global stop
    endpoints.forEach((endpointUrl) => {
      const endpointIndex = this.config.requests.findIndex(
        (req) => req.url === endpointUrl,
      );
      if (endpointIndex !== -1) {
        this.endpointStateManager.stopEndpoint(endpointIndex);
      }
    });
  }

  /**
   * Stops the early exit monitoring process.
   *
   * @remarks
   * Clears the monitoring interval if it exists, effectively stopping
   * threshold evaluation. This should be called during graceful shutdown
   * to prevent continued monitoring after test completion.
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}
