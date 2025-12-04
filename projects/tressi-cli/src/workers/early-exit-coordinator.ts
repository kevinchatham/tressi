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
   * Extracts threshold values from the config's workerEarlyExit section.
   * If early exit is disabled, returns a configuration with empty thresholds.
   * Handles default values for monitoring window and status codes.
   *
   * @throws {Error} If configuration parsing fails due to invalid data types
   */
  private parseThresholds(): EarlyExitThresholds {
    const exitConfig = this.config.options.workerEarlyExit;
    if (!exitConfig?.enabled) {
      return {
        perEndpoint: new Map(),
        statusCodes: new Set(),
        monitoringWindowMs: 1000,
      };
    }

    return {
      perEndpoint: new Map(
        (exitConfig.perEndpointThresholds || []).map((t) => [
          t.url,
          {
            errorRate: t.errorRateThreshold,
            errorCount: t.errorCountThreshold,
          },
        ]),
      ),
      statusCodes: new Set(exitConfig.workerExitStatusCodes || []),
      monitoringWindowMs: exitConfig.monitoringWindowMs || 1000,
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
   *
   * Only endpoints with configured thresholds are evaluated. The method aggregates
   * error counts across all workers that handle the endpoint using round-robin
   * distribution logic to locate the correct worker and local index.
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
        }
      }

      if (endpointTotalRequests === 0) return;

      const errorRate = endpointTotalErrors / endpointTotalRequests;

      if (threshold.errorRate && errorRate >= threshold.errorRate) {
        endpoints.push(request.url);
      }
      if (threshold.errorCount && endpointTotalErrors >= threshold.errorCount) {
        endpoints.push(request.url);
      }
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
