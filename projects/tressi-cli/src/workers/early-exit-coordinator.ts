import type { TressiConfig } from 'tressi-common';
import { Worker } from 'worker_threads';

import type { SharedMemoryManager } from './shared-memory-manager';

export interface EarlyExitThresholds {
  globalErrorRate?: number;
  globalErrorCount?: number;
  perEndpoint: Map<string, { errorRate?: number; errorCount?: number }>;
  statusCodes: Set<number>;
  monitoringWindowMs: number;
  stopMode: 'endpoint' | 'global';
}

export interface GlobalStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
}

export class EarlyExitCoordinator {
  private thresholds: EarlyExitThresholds;
  private monitoringInterval?: NodeJS.Timeout;
  private workers: Worker[] = [];

  constructor(
    private config: TressiConfig,
    private sharedMemory: SharedMemoryManager,
  ) {
    this.thresholds = this.parseThresholds();
  }

  private parseThresholds(): EarlyExitThresholds {
    const exitConfig = this.config.options.workerEarlyExit;
    if (!exitConfig?.enabled) {
      return {
        perEndpoint: new Map(),
        statusCodes: new Set(),
        monitoringWindowMs: 1000,
        stopMode: 'global',
      };
    }

    return {
      globalErrorRate: exitConfig.globalErrorRateThreshold,
      globalErrorCount: exitConfig.globalErrorCountThreshold,
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
      stopMode: exitConfig.stopMode || 'global',
    };
  }

  startMonitoring(workers: Worker[]): void {
    this.workers = workers;
    if (!this.config.options.workerEarlyExit?.enabled) return;

    this.monitoringInterval = setInterval(() => {
      this.checkEarlyExitConditions();
    }, this.thresholds.monitoringWindowMs);
  }

  private checkEarlyExitConditions(): void {
    const globalStats = this.sharedMemory.getGlobalStats();

    // Check global thresholds
    if (this.shouldTriggerGlobalExit(globalStats)) {
      this.triggerGlobalEarlyExit();
      return;
    }

    // Check per-endpoint thresholds
    if (this.thresholds.stopMode === 'endpoint') {
      const endpointsToStop = this.getEndpointsToStop();
      if (endpointsToStop.length > 0) {
        this.triggerEndpointEarlyExit(endpointsToStop);
      }
    }
  }

  private shouldTriggerGlobalExit(stats: GlobalStats): boolean {
    if (stats.totalRequests === 0) return false;

    const errorRate = stats.totalErrors / stats.totalRequests;

    return Boolean(
      (this.thresholds.globalErrorRate !== undefined &&
        errorRate >= this.thresholds.globalErrorRate) ||
        (this.thresholds.globalErrorCount !== undefined &&
          stats.totalErrors >= this.thresholds.globalErrorCount),
    );
  }

  private getEndpointsToStop(): string[] {
    const endpoints: string[] = [];
    const endpointStats = this.sharedMemory.getEndpointStats();

    for (const [url, stats] of Object.entries(endpointStats)) {
      const threshold = this.thresholds.perEndpoint.get(url);
      if (!threshold) continue;

      if (threshold.errorRate && stats.errorRate >= threshold.errorRate) {
        endpoints.push(url);
      }
      if (threshold.errorCount && stats.errorCount >= threshold.errorCount) {
        endpoints.push(url);
      }
    }

    return endpoints;
  }

  private triggerGlobalEarlyExit(): void {
    process.stdout.write(
      '🚨 Global early exit triggered - stopping all workers\n',
    );
    this.sharedMemory.setEarlyExitFlag(true);
    this.stopAllWorkers();
  }

  private triggerEndpointEarlyExit(endpoints: string[]): void {
    process.stdout.write(
      `🚨 Endpoint early exit triggered for: ${endpoints.join(', ')}\n`,
    );
    for (const endpoint of endpoints) {
      const endpointIndex = this.config.requests.findIndex(
        (req) => req.url === endpoint,
      );
      if (endpointIndex !== -1) {
        this.sharedMemory.setEndpointExitFlag(endpointIndex, true);
      }
    }
  }

  private stopAllWorkers(): void {
    this.workers.forEach((worker) => {
      worker.postMessage({ type: 'early_exit' });
    });
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}
