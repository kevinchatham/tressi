/**
 * High-resolution performance monitoring for tressi load testing framework
 * Provides comprehensive metrics collection with minimal overhead
 */

/**
 * High-resolution timestamp using process.hrtime.bigint()
 * Returns nanoseconds since process start
 */
function getHighResTimestamp(): bigint {
  return process.hrtime.bigint();
}

/**
 * Converts nanoseconds to milliseconds
 */
function nsToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

/**
 * Request lifecycle phases for detailed timing
 */
export enum RequestPhase {
  QUEUING = 'queuing',
  THROTTLING = 'throttling',
  CONNECTION_ACQUISITION = 'connection_acquisition',
  REQUEST_EXECUTION = 'request_execution',
  RESPONSE_PROCESSING = 'response_processing',
  TOKEN_ACQUISITION = 'token_acquisition',
}

/**
 * Performance metrics for a single request
 */
export interface RequestMetrics {
  id: string;
  endpointKey: string;
  startTime: bigint;
  phases: Map<
    RequestPhase,
    {
      startTime: bigint;
      duration: bigint;
    }
  >;
  totalDuration: bigint;
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Resource utilization metrics
 */
export interface ResourceMetrics {
  timestamp: bigint;
  connectionPool: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    pendingRequests: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  workers: {
    activeCount: number;
    scalingEvents: number;
    averageConcurrency: number;
  };
}

/**
 * Rate limiting telemetry
 */
export interface RateLimitMetrics {
  timestamp: bigint;
  endpointKey: string;
  bucketState: {
    currentTokens: number;
    capacity: number;
    refillRate: number;
    utilization: number;
  };
  throttling: {
    queueDepth: number;
    averageWaitTime: number;
    maxWaitTime: number;
    rejectedRequests: number;
  };
  tokenFlow: {
    acquired: number;
    failed: number;
    averageAcquisitionTime: number;
  };
}

/**
 * Shutdown analysis metrics
 */
export interface ShutdownMetrics {
  startTime: bigint;
  endTime: bigint;
  totalDuration: bigint;
  activeRequests: number;
  drainedRequests: number;
  connectionCleanupDuration: bigint;
  resourceDeallocationDuration: bigint;
}

/**
 * Export interface for metrics
 */
export interface ExportedMetrics {
  requestMetrics: Array<{
    id: string;
    endpointKey: string;
    startTime: number;
    phases: Array<{
      phase: RequestPhase;
      duration: number;
    }>;
    totalDuration: number;
    success: boolean;
    statusCode?: number;
    error?: string;
  }>;
  resourceMetrics: Array<{
    timestamp: number;
    connectionPool: {
      activeConnections: number;
      idleConnections: number;
      totalConnections: number;
      pendingRequests: number;
    };
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      arrayBuffers: number;
    };
    workers: {
      activeCount: number;
      scalingEvents: number;
      averageConcurrency: number;
    };
  }>;
  rateLimitMetrics: Record<
    string,
    Array<{
      timestamp: number;
      endpointKey: string;
      bucketState: {
        currentTokens: number;
        capacity: number;
        refillRate: number;
        utilization: number;
      };
      throttling: {
        queueDepth: number;
        averageWaitTime: number;
        maxWaitTime: number;
        rejectedRequests: number;
      };
      tokenFlow: {
        acquired: number;
        failed: number;
        averageAcquisitionTime: number;
      };
    }>
  >;
  shutdownMetrics?: {
    startTime: number;
    endTime: number;
    totalDuration: number;
    activeRequests: number;
    drainedRequests: number;
    connectionCleanupDuration: number;
    resourceDeallocationDuration: number;
  };
  summary: {
    requests: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageLatency: number;
      phaseBreakdown: Record<
        RequestPhase,
        { average: number; max: number; count: number }
      >;
    };
    resources: {
      averageMemoryUsage: number;
      peakMemoryUsage: number;
      averageActiveConnections: number;
      peakActiveConnections: number;
      averageWorkerCount: number;
      scalingEvents: number;
    };
    rateLimits: Record<
      string,
      {
        averageUtilization: number;
        averageQueueDepth: number;
        averageWaitTime: number;
        totalAcquired: number;
        totalFailed: number;
      }
    >;
  };
}

/**
 * Rate limiting summary interface
 */
interface RateLimitSummary {
  averageUtilization: number;
  averageQueueDepth: number;
  averageWaitTime: number;
  totalAcquired: number;
  totalFailed: number;
}

/**
 * Main performance monitor class
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private requestMetrics: Map<string, RequestMetrics> = new Map();
  private resourceMetrics: ResourceMetrics[] = [];
  private rateLimitMetrics: Map<string, RateLimitMetrics[]> = new Map();
  private shutdownMetrics?: ShutdownMetrics;
  private startTime: bigint;
  private maxMetricsSize = 10000;

  private constructor() {
    this.startTime = getHighResTimestamp();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start tracking a new request
   */
  startRequest(endpointKey: string): string {
    const id = `${endpointKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metrics: RequestMetrics = {
      id,
      endpointKey,
      startTime: getHighResTimestamp(),
      phases: new Map(),
      totalDuration: 0n,
      success: false,
    };

    this.requestMetrics.set(id, metrics);

    // Clean up old metrics if we're over the limit
    if (this.requestMetrics.size > this.maxMetricsSize) {
      const keys = Array.from(this.requestMetrics.keys());
      if (keys.length > 0) {
        this.requestMetrics.delete(keys[0]);
      }
    }

    return id;
  }

  /**
   * Record the start of a specific phase
   */
  startPhase(requestId: string, phase: RequestPhase): void {
    const metrics = this.requestMetrics.get(requestId);
    if (!metrics) return;

    const now = getHighResTimestamp();
    metrics.phases.set(phase, {
      startTime: now,
      duration: 0n,
    });
  }

  /**
   * Record the end of a specific phase
   */
  endPhase(requestId: string, phase: RequestPhase): void {
    const metrics = this.requestMetrics.get(requestId);
    if (!metrics) return;

    const phaseData = metrics.phases.get(phase);
    if (!phaseData) return;

    const now = getHighResTimestamp();
    phaseData.duration = now - phaseData.startTime;
  }

  /**
   * Complete a request with final metrics
   */
  completeRequest(
    requestId: string,
    success: boolean,
    statusCode?: number,
    error?: string,
  ): void {
    const metrics = this.requestMetrics.get(requestId);
    if (!metrics) return;

    const now = getHighResTimestamp();
    metrics.totalDuration = now - metrics.startTime;
    metrics.success = success;
    metrics.statusCode = statusCode;
    metrics.error = error;
  }

  /**
   * Record resource utilization metrics
   */
  recordResourceMetrics(
    workers: {
      activeCount: number;
      scalingEvents: number;
      averageConcurrency: number;
    },
    connectionPool?: {
      activeConnections: number;
      idleConnections: number;
      totalConnections: number;
      pendingRequests: number;
    },
  ): void {
    const memUsage = process.memoryUsage();
    const metrics: ResourceMetrics = {
      timestamp: getHighResTimestamp(),
      connectionPool: connectionPool || {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        pendingRequests: 0,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers || 0,
      },
      workers,
    };

    this.resourceMetrics.push(metrics);

    // Keep only last 1000 resource metrics
    if (this.resourceMetrics.length > 1000) {
      this.resourceMetrics.shift();
    }
  }

  /**
   * Record rate limiting metrics
   */
  recordRateLimitMetrics(
    endpointKey: string,
    metrics: {
      bucketState: {
        currentTokens: number;
        capacity: number;
        refillRate: number;
      };
      throttling: {
        queueDepth: number;
        averageWaitTime: number;
        maxWaitTime: number;
        rejectedRequests: number;
      };
      tokenFlow: {
        acquired: number;
        failed: number;
        averageAcquisitionTime: number;
      };
    },
  ): void {
    const rateMetrics: RateLimitMetrics = {
      timestamp: getHighResTimestamp(),
      endpointKey,
      bucketState: {
        ...metrics.bucketState,
        utilization:
          metrics.bucketState.currentTokens / metrics.bucketState.capacity,
      },
      throttling: metrics.throttling,
      tokenFlow: metrics.tokenFlow,
    };

    if (!this.rateLimitMetrics.has(endpointKey)) {
      this.rateLimitMetrics.set(endpointKey, []);
    }

    const endpointMetrics = this.rateLimitMetrics.get(endpointKey)!;
    endpointMetrics.push(rateMetrics);

    // Keep only last 1000 metrics per endpoint
    if (endpointMetrics.length > 1000) {
      endpointMetrics.shift();
    }
  }

  /**
   * Start shutdown analysis
   */
  startShutdown(): void {
    this.shutdownMetrics = {
      startTime: getHighResTimestamp(),
      endTime: 0n,
      totalDuration: 0n,
      activeRequests: 0,
      drainedRequests: 0,
      connectionCleanupDuration: 0n,
      resourceDeallocationDuration: 0n,
    };
  }

  /**
   * Complete shutdown analysis
   */
  completeShutdown(activeRequests: number, drainedRequests: number): void {
    if (!this.shutdownMetrics) return;

    const now = getHighResTimestamp();
    this.shutdownMetrics.endTime = now;
    this.shutdownMetrics.totalDuration = now - this.shutdownMetrics.startTime;
    this.shutdownMetrics.activeRequests = activeRequests;
    this.shutdownMetrics.drainedRequests = drainedRequests;
  }

  /**
   * Record connection cleanup duration
   */
  recordConnectionCleanupDuration(duration: bigint): void {
    if (this.shutdownMetrics) {
      this.shutdownMetrics.connectionCleanupDuration = duration;
    }
  }

  /**
   * Record resource deallocation duration
   */
  recordResourceDeallocationDuration(duration: bigint): void {
    if (this.shutdownMetrics) {
      this.shutdownMetrics.resourceDeallocationDuration = duration;
    }
  }

  /**
   * Get request metrics summary
   */
  getRequestMetricsSummary(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    phaseBreakdown: Record<
      RequestPhase,
      { average: number; max: number; count: number }
    >;
  } {
    const requests = Array.from(this.requestMetrics.values());
    const totalRequests = requests.length;
    const successfulRequests = requests.filter((r) => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const phaseBreakdown: Record<
      RequestPhase,
      { average: number; max: number; count: number }
    > = {
      [RequestPhase.QUEUING]: { average: 0, max: 0, count: 0 },
      [RequestPhase.THROTTLING]: { average: 0, max: 0, count: 0 },
      [RequestPhase.CONNECTION_ACQUISITION]: { average: 0, max: 0, count: 0 },
      [RequestPhase.REQUEST_EXECUTION]: { average: 0, max: 0, count: 0 },
      [RequestPhase.RESPONSE_PROCESSING]: { average: 0, max: 0, count: 0 },
      [RequestPhase.TOKEN_ACQUISITION]: { average: 0, max: 0, count: 0 },
    };

    // Calculate phase breakdowns
    for (const request of requests) {
      for (const [phase, data] of request.phases) {
        const durationMs = nsToMs(data.duration);
        phaseBreakdown[phase].count++;
        phaseBreakdown[phase].average += durationMs;
        phaseBreakdown[phase].max = Math.max(
          phaseBreakdown[phase].max,
          durationMs,
        );
      }
    }

    // Calculate averages
    for (const phase of Object.values(phaseBreakdown)) {
      if (phase.count > 0) {
        phase.average = phase.average / phase.count;
      }
    }

    const averageLatency =
      requests.length > 0
        ? requests.reduce((sum, r) => sum + nsToMs(r.totalDuration), 0) /
          requests.length
        : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency,
      phaseBreakdown,
    };
  }

  /**
   * Get resource utilization summary
   */
  getResourceMetricsSummary(): {
    averageMemoryUsage: number;
    peakMemoryUsage: number;
    averageActiveConnections: number;
    peakActiveConnections: number;
    averageWorkerCount: number;
    scalingEvents: number;
  } {
    if (this.resourceMetrics.length === 0) {
      return {
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        averageActiveConnections: 0,
        peakActiveConnections: 0,
        averageWorkerCount: 0,
        scalingEvents: 0,
      };
    }

    let totalMemory = 0;
    let peakMemory = 0;
    let totalConnections = 0;
    let peakConnections = 0;
    let totalWorkers = 0;
    let totalScalingEvents = 0;

    for (const metric of this.resourceMetrics) {
      const memoryUsage = metric.memory.heapUsed;
      totalMemory += memoryUsage;
      peakMemory = Math.max(peakMemory, memoryUsage);

      const connections = metric.connectionPool.activeConnections;
      totalConnections += connections;
      peakConnections = Math.max(peakConnections, connections);

      totalWorkers += metric.workers.activeCount;
      totalScalingEvents += metric.workers.scalingEvents;
    }

    return {
      averageMemoryUsage: totalMemory / this.resourceMetrics.length,
      peakMemoryUsage: peakMemory,
      averageActiveConnections: totalConnections / this.resourceMetrics.length,
      peakActiveConnections: peakConnections,
      averageWorkerCount: totalWorkers / this.resourceMetrics.length,
      scalingEvents: totalScalingEvents,
    };
  }

  /**
   * Get rate limiting summary
   */
  getRateLimitSummary(): Record<string, RateLimitSummary> {
    const summary: Record<string, RateLimitSummary> = {};

    for (const [endpointKey, metrics] of this.rateLimitMetrics) {
      if (metrics.length === 0) continue;

      let totalUtilization = 0;
      let totalQueueDepth = 0;
      let totalWaitTime = 0;
      let totalAcquired = 0;
      let totalFailed = 0;

      for (const metric of metrics) {
        totalUtilization += metric.bucketState.utilization;
        totalQueueDepth += metric.throttling.queueDepth;
        totalWaitTime += metric.throttling.averageWaitTime;
        totalAcquired += metric.tokenFlow.acquired;
        totalFailed += metric.tokenFlow.failed;
      }

      summary[endpointKey] = {
        averageUtilization: totalUtilization / metrics.length,
        averageQueueDepth: totalQueueDepth / metrics.length,
        averageWaitTime: totalWaitTime / metrics.length,
        totalAcquired,
        totalFailed,
      };
    }

    return summary;
  }

  /**
   * Get shutdown metrics
   */
  getShutdownMetrics(): ShutdownMetrics | undefined {
    return this.shutdownMetrics;
  }

  /**
   * Export all metrics as JSON
   */
  exportMetrics(): ExportedMetrics {
    return {
      requestMetrics: Array.from(this.requestMetrics.values()).map((m) => ({
        id: m.id,
        endpointKey: m.endpointKey,
        startTime: nsToMs(m.startTime),
        phases: Array.from(m.phases.entries()).map(([phase, data]) => ({
          phase,
          duration: nsToMs(data.duration),
        })),
        totalDuration: nsToMs(m.totalDuration),
        success: m.success,
        statusCode: m.statusCode,
        error: m.error,
      })),
      resourceMetrics: this.resourceMetrics.map((m) => ({
        timestamp: nsToMs(m.timestamp),
        connectionPool: m.connectionPool,
        memory: m.memory,
        workers: m.workers,
      })),
      rateLimitMetrics: Object.fromEntries(
        Array.from(this.rateLimitMetrics.entries()).map(([key, metrics]) => [
          key,
          metrics.map((m) => ({
            timestamp: nsToMs(m.timestamp),
            endpointKey: m.endpointKey,
            bucketState: m.bucketState,
            throttling: m.throttling,
            tokenFlow: m.tokenFlow,
          })),
        ]),
      ),
      shutdownMetrics: this.shutdownMetrics
        ? {
            startTime: this.shutdownMetrics.startTime
              ? nsToMs(this.shutdownMetrics.startTime)
              : 0,
            endTime: this.shutdownMetrics.endTime
              ? nsToMs(this.shutdownMetrics.endTime)
              : 0,
            totalDuration: this.shutdownMetrics.totalDuration
              ? nsToMs(this.shutdownMetrics.totalDuration)
              : 0,
            connectionCleanupDuration: this.shutdownMetrics
              .connectionCleanupDuration
              ? nsToMs(this.shutdownMetrics.connectionCleanupDuration)
              : 0,
            resourceDeallocationDuration: this.shutdownMetrics
              .resourceDeallocationDuration
              ? nsToMs(this.shutdownMetrics.resourceDeallocationDuration)
              : 0,
            activeRequests: this.shutdownMetrics.activeRequests,
            drainedRequests: this.shutdownMetrics.drainedRequests,
          }
        : undefined,
      summary: {
        requests: this.getRequestMetricsSummary(),
        resources: this.getResourceMetricsSummary(),
        rateLimits: this.getRateLimitSummary(),
      },
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.requestMetrics.clear();
    this.resourceMetrics = [];
    this.rateLimitMetrics.clear();
    this.shutdownMetrics = undefined;
    this.startTime = getHighResTimestamp();
  }
}
