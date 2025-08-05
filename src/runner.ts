import { EventEmitter } from 'events';
import { build, Histogram } from 'hdr-histogram-js';
import { performance } from 'perf_hooks';
import { request } from 'undici';

import { CircularBuffer } from './circular-buffer';
import { RequestConfig } from './config';
import { Distribution } from './distribution';
import { globalAgentManager } from './http-agent';
import { RunOptions } from './index';
import { PerformanceMonitor, RequestPhase } from './perf-monitor';
import { RequestResult } from './stats';
import { TokenBucketManager } from './token-bucket-manager';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The main load test runner. It orchestrates the test execution, manages workers,
 * and collects results. It extends EventEmitter to provide hooks into its lifecycle.
 */
export class Runner extends EventEmitter {
  private options: RunOptions;
  private requests: RequestConfig[];
  private headers: Record<string, string>;
  private sampledResults: RequestResult[] = [];
  private histogram: Histogram;
  private distribution: Distribution;
  private endpointHistograms: Map<string, Histogram> = new Map();
  private recentLatenciesForSpinner: CircularBuffer<number>;
  private recentRequestTimestamps: CircularBuffer<number>;
  private statusCodeMap: Record<number, number> = {};
  private successfulRequestsByEndpoint: Map<string, number> = new Map();
  private failedRequestsByEndpoint: Map<string, number> = new Map();
  private stopped = false;
  private startTime: number = 0;
  private currentTargetRps: number;
  private successfulRequests = 0;
  private failedRequests = 0;
  private activeWorkers: { promise: Promise<void>; stop: () => void }[] = [];
  private testTimeout?: NodeJS.Timeout;
  private rampUpInterval?: NodeJS.Timeout;
  private autoscaleInterval?: NodeJS.Timeout;
  private tokenBucketManager: TokenBucketManager;
  private globalTargetRps?: number;
  private perfMonitor: PerformanceMonitor;

  // Object allocation optimizations
  private headersPool: Record<string, string>[] = [];
  private resultPool: RequestResult[] = [];
  private endpointKeyCache = new Map<string, string>();
  private responseSamplingSets = new Map<string, Set<number>>();
  private maxPoolSize = 1000;

  /**
   * Creates a new Runner instance.
   * @param options The run options.
   * @param requests An array of request configurations to be used in the test.
   * @param headers A record of global headers to be sent with each request.
   * @param globalTargetRps Global target RPS from configuration
   */
  constructor(
    options: RunOptions,
    requests: RequestConfig[],
    headers: Record<string, string>,
    globalTargetRps?: number,
  ) {
    super();

    // Validate early exit options
    const validatedOptions = this.validateEarlyExitOptions(options);
    this.options = validatedOptions;
    this.requests = requests;
    this.headers = headers;
    this.histogram = build();
    this.distribution = new Distribution();
    this.currentTargetRps = 0;
    this.globalTargetRps = globalTargetRps;

    // Initialize TokenBucketManager with default rate limit configuration
    const defaultRateLimit = { capacity: 2, refillRate: 1 };
    this.tokenBucketManager = new TokenBucketManager(defaultRateLimit);
    this.perfMonitor = PerformanceMonitor.getInstance();

    // Configure per-endpoint rate limits from request configurations
    this.configureEndpointRateLimits();

    // Estimate buffer size: 10k requests as default buffer
    const bufferSize = 10000;
    this.recentRequestTimestamps = new CircularBuffer<number>(bufferSize);
    this.recentLatenciesForSpinner = new CircularBuffer<number>(1000);

    // Initialize optimization pools with reasonable starting capacity
    this.headersPool = [];
    this.resultPool = [];
    this.endpointKeyCache = new Map();
    this.responseSamplingSets = new Map();
  }

  /**
   * Configures per-endpoint rate limits based on targetRps from request configurations
   */
  private configureEndpointRateLimits(): void {
    for (const request of this.requests) {
      const method = request.method || 'GET';
      const endpointKey = this.getEndpointKey(method, request.url);

      // Configure rate limits based on targetRps
      const targetRps = (request as { targetRps?: number }).targetRps;
      if (targetRps) {
        // Use targetRps to configure rate limiting
        // Capacity = targetRps * 2 (allow burst of 2 seconds)
        // RefillRate = targetRps (sustained rate)
        this.tokenBucketManager.configureEndpoint(endpointKey, {
          capacity: Math.max(2, targetRps * 2),
          refillRate: targetRps,
        });
      } else {
        // Default rate limit when targetRps is not specified
        this.tokenBucketManager.configureEndpoint(endpointKey, {
          capacity: 2, // Burst capacity of 2
          refillRate: 1, // 1 request per second
        });
      }
    }
  }

  /**
   * Validates early exit configuration options with proper defaults and constraints.
   * @param options The raw RunOptions to validate
   * @returns Validated RunOptions with defaults applied
   */
  private validateEarlyExitOptions(options: RunOptions): RunOptions {
    const validated = { ...options };

    // Set defaults for early exit options
    validated.earlyExitOnError = options.earlyExitOnError ?? false;
    validated.errorRateThreshold = options.errorRateThreshold;
    validated.errorCountThreshold = options.errorCountThreshold;
    validated.errorStatusCodes = options.errorStatusCodes;

    // Validate constraints when early exit is enabled
    if (validated.earlyExitOnError) {
      // Validate error rate threshold (must be between 0.0 and 1.0)
      if (validated.errorRateThreshold !== undefined) {
        if (
          typeof validated.errorRateThreshold !== 'number' ||
          validated.errorRateThreshold < 0 ||
          validated.errorRateThreshold > 1
        ) {
          throw new Error(
            'errorRateThreshold must be a number between 0.0 and 1.0',
          );
        }
      }

      // Validate error count threshold (must be positive integer)
      if (validated.errorCountThreshold !== undefined) {
        if (
          !Number.isInteger(validated.errorCountThreshold) ||
          validated.errorCountThreshold < 0
        ) {
          throw new Error('errorCountThreshold must be a non-negative integer');
        }
      }

      // Validate error status codes (must be array of valid HTTP status codes)
      if (validated.errorStatusCodes !== undefined) {
        if (!Array.isArray(validated.errorStatusCodes)) {
          throw new Error('errorStatusCodes must be an array of numbers');
        }
        for (const code of validated.errorStatusCodes) {
          if (!Number.isInteger(code) || code < 100 || code > 599) {
            throw new Error(
              `Invalid HTTP status code: ${code}. Must be between 100-599`,
            );
          }
        }
      }

      // Ensure at least one threshold is provided when early exit is enabled
      if (
        validated.errorRateThreshold === undefined &&
        validated.errorCountThreshold === undefined &&
        validated.errorStatusCodes === undefined
      ) {
        throw new Error(
          'When earlyExitOnError is enabled, at least one of errorRateThreshold, errorCountThreshold, or errorStatusCodes must be provided',
        );
      }
    }

    return validated;
  }

  /**
   * Records a new request result, updating all relevant statistics.
   * @param result The `RequestResult` to record.
   */
  public onResult(result: RequestResult): void {
    if (this.sampledResults.length < 1000) {
      // Create a shallow copy for sampled results to avoid pool contamination
      this.sampledResults.push({ ...result });
    }

    this.histogram.recordValue(result.latencyMs);
    this.distribution.add(result.latencyMs);

    const endpointKey = this.getEndpointKey(result.method, result.url);
    if (!this.endpointHistograms.has(endpointKey)) {
      this.endpointHistograms.set(endpointKey, build());
    }
    this.endpointHistograms.get(endpointKey)!.recordValue(result.latencyMs);

    // Keep a small, rotating log of recent latencies for the non-UI spinner
    if (!this.options.useUI) {
      this.recentLatenciesForSpinner.add(result.latencyMs);
    }

    this.recentRequestTimestamps.add(performance.now());
    this.statusCodeMap[result.status] =
      (this.statusCodeMap[result.status] || 0) + 1;

    if (result.success) {
      this.successfulRequests++;
      this.successfulRequestsByEndpoint.set(
        endpointKey,
        (this.successfulRequestsByEndpoint.get(endpointKey) || 0) + 1,
      );
    } else {
      this.failedRequests++;
      this.failedRequestsByEndpoint.set(
        endpointKey,
        (this.failedRequestsByEndpoint.get(endpointKey) || 0) + 1,
      );
    }

    // Release result object back to pool
    this.releaseResultObject(result);
  }

  /**
   * Gets a sample of the results collected during the test run.
   * @returns An array of `RequestResult` objects.
   */
  public getSampledResults(): RequestResult[] {
    return this.sampledResults;
  }

  /**
   * Gets the histogram containing all latency values.
   * @returns The HDR histogram instance.
   */
  public getHistogram(): Histogram {
    return this.histogram;
  }

  /**
   * Generates a latency distribution report.
   * @param options - The options for generating the distribution.
   * @param options.count - The number of buckets to group latencies into.
   * @returns An array of objects representing each bucket in the distribution.
   */
  public getLatencyDistribution(options: {
    count: number;
    chartWidth?: number;
  }): {
    latency: string;
    count: string;
    percent: string;
    cumulative: string;
    chart: string;
  }[] {
    return this.distribution.getLatencyDistribution(options);
  }

  /**
   * Gets the full Distribution instance.
   * @returns The `Distribution` instance containing all latency data.
   */
  public getDistribution(): Distribution {
    return this.distribution;
  }

  /**
   * Gets the map of histograms for each endpoint.
   * @returns A map where keys are endpoint identifiers and values are HDR histograms.
   */
  public getEndpointHistograms(): Map<string, Histogram> {
    return this.endpointHistograms;
  }

  /**
   * Gets an array of recent latency values for the non-UI spinner.
   * @returns An array of latency numbers in milliseconds.
   */
  public getRecentLatencies(): number[] {
    return this.recentLatenciesForSpinner.getAll();
  }

  /**
   * Gets a map of status codes and their counts.
   * @returns A record where keys are status codes and values are their counts.
   */
  public getStatusCodeMap(): Record<number, number> {
    return this.statusCodeMap;
  }

  /**
   * Gets the total count of successful requests.
   * @returns The number of successful requests.
   */
  public getSuccessfulRequestsCount(): number {
    return this.successfulRequests;
  }

  /**
   * Gets the total count of failed requests.
   * @returns The number of failed requests.
   */
  public getFailedRequestsCount(): number {
    return this.failedRequests;
  }

  public getSuccessfulRequestsByEndpoint(): Map<string, number> {
    return this.successfulRequestsByEndpoint;
  }

  public getFailedRequestsByEndpoint(): Map<string, number> {
    return this.failedRequestsByEndpoint;
  }

  /**
   * Calculates and returns the average latency for all requests.
   * @returns The average latency in milliseconds.
   */
  public getAverageLatency(): number {
    return this.histogram.mean;
  }

  /**
   * Gets the timestamp when the test run started.
   * @returns The start time as a Unix timestamp.
   */
  public getStartTime(): number {
    return this.startTime;
  }

  /**
   * Gets the current target requests per second (Req/s).
   * This value changes during ramp-up.
   * @returns The current target Req/s.
   */
  public getCurrentTargetRps(): number {
    return Math.round(this.currentTargetRps);
  }

  /**
   * Calculates the total target RPS across all endpoints based on per-request targetRps
   * @returns Total target RPS for autoscaling
   */
  private calculateTotalTargetRps(): number {
    let totalTargetRps = 0;

    // Check if global targetRps is specified
    if (this.globalTargetRps && this.globalTargetRps > 0) {
      return this.globalTargetRps;
    }

    for (const request of this.requests) {
      // Use per-request targetRps if specified, otherwise use default
      const targetRps = (request as { targetRps?: number }).targetRps || 100; // Default 100 RPS per endpoint
      totalTargetRps += targetRps;
    }

    return totalTargetRps;
  }

  /**
   * Calculates the actual requests per second (Req/s) over the last second.
   * @returns The current actual Req/s.
   */
  public getCurrentRps(): number {
    const now = performance.now();
    const oneSecondAgo = now - 1000;

    const timestamps = this.recentRequestTimestamps.getAll();
    let count = 0;
    // Iterate backwards since recent timestamps are at the end
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] >= oneSecondAgo) {
        count++;
      } else {
        // The timestamps are ordered, so we can stop.
        break;
      }
    }
    return count;
  }

  /**
   * Gets the current number of active workers.
   * @returns The number of workers.
   */
  public getWorkerCount(): number {
    if (this.options.autoscale) {
      return this.activeWorkers.length;
    }
    return this.options.workers ?? 10;
  }

  /**
   * Starts the load test. This is the main entry point for the runner.
   * It sets up workers, timers, and ramp-up/autoscaling logic.
   */
  public async run(): Promise<void> {
    this.startTime = performance.now();
    this.perfMonitor.reset();

    const {
      workers = 10,
      durationSec = 10,
      rampUpTimeSec = 0,
      autoscale = false,
    } = this.options;

    // The main timer for the total test duration starts now
    const durationMs = durationSec * 1000;
    this.testTimeout = setTimeout(() => this.stop(), durationMs);

    // Start resource monitoring
    this.startResourceMonitoring();

    // If ramp-up is enabled, start the governor
    if (rampUpTimeSec > 0) {
      this.rampUpInterval = setInterval(() => {
        const elapsedTimeSec = (performance.now() - this.startTime) / 1000;

        if (this.stopped) {
          clearInterval(this.rampUpInterval as NodeJS.Timeout);
          return;
        }

        const rampUpProgress = Math.min(elapsedTimeSec / rampUpTimeSec, 1);

        // Ramp up to a reasonable target based on per-endpoint configuration
        // Use the calculated total target RPS as the maximum
        const totalTargetRps = this.calculateTotalTargetRps();
        this.currentTargetRps = Math.round(totalTargetRps * rampUpProgress);
      }, 1000); // Update every second
    }

    if (autoscale) {
      // Start with one worker
      this.addWorker();

      this.autoscaleInterval = setInterval(() => {
        if (this.stopped) {
          clearInterval(this.autoscaleInterval as NodeJS.Timeout);
          return;
        }

        const currentRps = this.getCurrentRps();
        const currentWorkers = this.activeWorkers.length;

        if (currentWorkers === 0) {
          this.addWorker();
          return;
        }

        // Calculate per-endpoint target RPS for autoscaling
        const totalTargetRps = this.calculateTotalTargetRps();
        if (totalTargetRps <= 0) return;

        const scaleUpThreshold = totalTargetRps * 0.9;
        const scaleDownThreshold = totalTargetRps * 1.1;

        if (currentRps < scaleUpThreshold && currentWorkers < workers) {
          const rpsDeficit = totalTargetRps - currentRps;
          const avgRpsPerWorker =
            currentWorkers > 0 ? currentRps / currentWorkers : 10;
          const workersNeeded = rpsDeficit / avgRpsPerWorker;
          let workersToAdd = Math.ceil(workersNeeded * 0.25);
          workersToAdd = Math.max(1, workersToAdd);
          workersToAdd = Math.min(workersToAdd, workers - currentWorkers);

          for (let i = 0; i < workersToAdd; i++) {
            this.addWorker();
          }
        } else if (currentRps > scaleDownThreshold && currentWorkers > 1) {
          const rpsSurplus = currentRps - totalTargetRps;
          const avgRpsPerWorker = currentRps / currentWorkers;
          const workersToCut = rpsSurplus / avgRpsPerWorker;
          let workersToRemove = Math.ceil(workersToCut * 0.25);
          workersToRemove = Math.max(1, workersToRemove);
          workersToRemove = Math.min(workersToRemove, currentWorkers - 1);

          for (let i = 0; i < workersToRemove; i++) {
            this.removeWorker();
          }
        }
      }, 2000); // Check every 2 seconds
      await Promise.all(this.activeWorkers.map((w) => w.promise));
    } else {
      const workerPromises = Array.from({ length: workers }, () =>
        this.runWorker(),
      );
      await Promise.all(workerPromises);
    }

    this.cleanup();
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    const monitorInterval = setInterval(() => {
      if (this.stopped) {
        clearInterval(monitorInterval);
        return;
      }

      this.perfMonitor.recordResourceMetrics({
        activeCount: this.getWorkerCount(),
        scalingEvents: this.activeWorkers.length,
        averageConcurrency: this.calculateOptimalConcurrency(),
      });
    }, 1000);
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    // Start shutdown analysis
    this.perfMonitor.startShutdown();
    this.perfMonitor.completeShutdown(
      this.activeWorkers.length,
      this.successfulRequests + this.failedRequests,
    );

    this.activeWorkers.forEach((w) => w.stop());
    this.cleanup();
    this.emit('stop');
  }

  /**
   * Cleans up all active timers and intervals.
   */
  private cleanup(): void {
    const cleanupStart = process.hrtime.bigint();

    if (this.testTimeout) {
      clearTimeout(this.testTimeout);
      this.testTimeout = undefined;
    }
    if (this.rampUpInterval) {
      clearInterval(this.rampUpInterval);
      this.rampUpInterval = undefined;
    }
    if (this.autoscaleInterval) {
      clearInterval(this.autoscaleInterval);
      this.autoscaleInterval = undefined;
    }

    // Clear object pools and caches
    this.headersPool.length = 0;
    this.resultPool.length = 0;
    this.endpointKeyCache.clear();
    this.responseSamplingSets.clear();

    // Close all HTTP agents to free up connections
    const connectionCleanupStart = process.hrtime.bigint();
    globalAgentManager.closeAll();
    const connectionCleanupEnd = process.hrtime.bigint();

    this.perfMonitor.recordConnectionCleanupDuration(
      connectionCleanupEnd - connectionCleanupStart,
    );
    this.perfMonitor.recordResourceDeallocationDuration(
      process.hrtime.bigint() - cleanupStart,
    );
  }

  /**
   * Adds a new worker to the pool. Used by the autoscaler.
   */
  private addWorker(): void {
    let workerStopped = false;
    const stop = (): void => {
      workerStopped = true;
    };
    const promise = this.runWorker(() => workerStopped);
    this.activeWorkers.push({ promise, stop });
  }

  /**
   * Removes a worker from the pool and stops it. Used by the autoscaler.
   */
  private removeWorker(): void {
    const worker = this.activeWorkers.pop();
    if (worker) {
      worker.stop();
    }
  }

  /**
   * Gets a reusable headers object from the pool or creates a new one
   */
  private getHeadersObject(): Record<string, string> {
    return this.headersPool.pop() || {};
  }

  /**
   * Returns a headers object to the pool for reuse
   */
  private releaseHeadersObject(headers: Record<string, string>): void {
    if (this.headersPool.length < this.maxPoolSize) {
      // Clear the object for reuse
      for (const key in headers) {
        delete headers[key];
      }
      this.headersPool.push(headers);
    }
  }

  /**
   * Gets a RequestResult object from the pool or creates a new one
   */
  private getResultObject(): RequestResult {
    return this.resultPool.pop() || ({} as RequestResult);
  }

  /**
   * Returns a RequestResult object to the pool for reuse
   */
  private releaseResultObject(result: RequestResult): void {
    if (this.resultPool.length < this.maxPoolSize) {
      // Clear the object for reuse
      result.method = '';
      result.url = '';
      result.status = 0;
      result.latencyMs = 0;
      result.success = false;
      result.body = undefined;
      result.error = undefined;
      result.timestamp = 0;
      this.resultPool.push(result);
    }
  }

  /**
   * Gets a cached endpoint key to avoid string concatenation
   */
  private getEndpointKey(method: string, url: string): string {
    const cacheKey = `${method}|${url}`;
    let endpointKey = this.endpointKeyCache.get(cacheKey);
    if (!endpointKey) {
      endpointKey = `${method} ${url}`;
      this.endpointKeyCache.set(cacheKey, endpointKey);
    }
    return endpointKey;
  }

  /**
   * Gets a reusable Set for response sampling
   */
  private getResponseSamplingSet(endpointKey: string): Set<number> {
    let set = this.responseSamplingSets.get(endpointKey);
    if (!set) {
      set = new Set();
      this.responseSamplingSets.set(endpointKey, set);
    }
    return set;
  }

  /**
   * Checks if early exit conditions are met based on configured thresholds.
   * This method is thread-safe as it only reads atomic counters and maps.
   * @returns true if early exit conditions are met, false otherwise
   */
  private shouldEarlyExit(): boolean {
    if (!this.options.earlyExitOnError) {
      return false;
    }

    const totalRequests = this.successfulRequests + this.failedRequests;
    if (totalRequests === 0) {
      return false;
    }

    // Check error rate threshold
    if (this.options.errorRateThreshold !== undefined) {
      const errorRate = this.failedRequests / totalRequests;
      if (errorRate >= this.options.errorRateThreshold) {
        return true;
      }
    }

    // Check error count threshold
    if (this.options.errorCountThreshold !== undefined) {
      if (this.failedRequests >= this.options.errorCountThreshold) {
        return true;
      }
    }

    // Check specific status codes threshold
    if (this.options.errorStatusCodes !== undefined) {
      for (const code of this.options.errorStatusCodes) {
        if (this.statusCodeMap[code] > 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Makes a single HTTP request and returns the result
   * @param req The request configuration
   * @returns Promise<RequestResult> The request result
   */
  private async makeSingleRequest(req: RequestConfig): Promise<RequestResult> {
    const start = performance.now();
    const headers = this.getHeadersObject();
    const result = this.getResultObject();
    const method = req.method || 'GET';
    const endpointKey = this.getEndpointKey(method, req.url);

    // Start performance tracking
    const requestId = this.perfMonitor.startRequest(endpointKey);
    this.perfMonitor.startPhase(requestId, RequestPhase.TOKEN_ACQUISITION);

    try {
      // Apply per-endpoint rate limiting using TokenBucketManager with throttling
      // Use throttling to intelligently pace requests instead of rejecting them
      const delay = await this.tokenBucketManager.acquireWithDelay(
        endpointKey,
        1,
      );

      this.perfMonitor.endPhase(requestId, RequestPhase.TOKEN_ACQUISITION);
      this.perfMonitor.startPhase(
        requestId,
        RequestPhase.CONNECTION_ACQUISITION,
      );

      // If we have a delay, account for it in the latency
      if (delay > 0) {
        // The delay is already included in the total time since we awaited
        // No additional action needed
      }

      // Reuse headers object instead of creating new one
      Object.assign(headers, this.headers, req.headers);

      // Use per-endpoint agents in production, global dispatcher in tests
      const dispatcher =
        process.env.NODE_ENV !== 'test'
          ? globalAgentManager.getAgent(req.url)
          : undefined;

      this.perfMonitor.endPhase(requestId, RequestPhase.CONNECTION_ACQUISITION);
      this.perfMonitor.startPhase(requestId, RequestPhase.REQUEST_EXECUTION);

      const { statusCode, body: responseBody } = await request(req.url, {
        method: req.method || 'GET',
        headers,
        body:
          req.payload === undefined ? undefined : JSON.stringify(req.payload),
        dispatcher,
      });

      this.perfMonitor.endPhase(requestId, RequestPhase.REQUEST_EXECUTION);
      this.perfMonitor.startPhase(requestId, RequestPhase.RESPONSE_PROCESSING);

      let body: string | undefined;
      const sampledCodesForEndpoint = this.getResponseSamplingSet(endpointKey);

      // Check if we should sample this status code for this endpoint
      if (!sampledCodesForEndpoint.has(statusCode)) {
        try {
          body = await responseBody.text();
          sampledCodesForEndpoint.add(statusCode);
        } catch (e) {
          // Ignore body read errors, it might be empty.
          body = `(Could not read body: ${(e as Error).message}`;
        }
      }

      const latencyMs = Math.max(0, performance.now() - start);

      this.perfMonitor.endPhase(requestId, RequestPhase.RESPONSE_PROCESSING);
      this.perfMonitor.completeRequest(requestId, true, statusCode);

      // Populate result object from pool
      result.method = method;
      result.url = req.url;
      result.status = statusCode;
      result.latencyMs = latencyMs;
      result.success = statusCode >= 200 && statusCode < 300;
      result.body = body; // Will be undefined if not sampled
      result.timestamp = performance.now();

      return result;
    } catch (err) {
      const latencyMs = Math.max(0, performance.now() - start);

      this.perfMonitor.endPhase(requestId, RequestPhase.REQUEST_EXECUTION);
      this.perfMonitor.completeRequest(
        requestId,
        false,
        0,
        (err as Error).message,
      );

      // Populate result object for error case
      result.method = method;
      result.url = req.url;
      result.status = 0;
      result.latencyMs = latencyMs;
      result.success = false;
      result.error = (err as Error).message;
      result.timestamp = performance.now();

      return result;
    } finally {
      // Always release headers object back to pool
      this.releaseHeadersObject(headers);
      // Note: result object is released by onResult after it's processed
    }
  }

  /**
   * Calculates the optimal concurrency level for this worker based on target RPS and worker count
   * @returns The number of concurrent requests this worker should make
   */
  private calculateOptimalConcurrency(): number {
    const workerCount = this.getWorkerCount();
    const targetRps = this.currentTargetRps;

    if (targetRps <= 0 || workerCount <= 0) {
      // Default concurrency when no RPS target or no workers
      return Math.max(1, this.options.concurrentRequestsPerWorker ?? 10);
    }

    // Calculate optimal concurrency based on target RPS per worker
    const targetRpsPerWorker = targetRps / workerCount;

    // Use configured value if provided, otherwise calculate dynamically
    if (this.options.concurrentRequestsPerWorker !== undefined) {
      return Math.max(
        1,
        Math.min(
          this.options.concurrentRequestsPerWorker,
          Math.ceil(targetRpsPerWorker),
        ),
      );
    }

    // Dynamic calculation: ensure we can meet target RPS with reasonable concurrency
    // Allow up to 50 concurrent requests per worker, but at least 1
    const dynamicConcurrency = Math.max(
      1,
      Math.min(50, Math.ceil(targetRpsPerWorker)),
    );

    return dynamicConcurrency;
  }

  /**
   * The core worker function. It runs in a loop, making concurrent requests and respecting
   * the rate limit (RPS) until instructed to stop.
   * @param isStopped A function that returns true if the worker should stop.
   *                  Defaults to checking the main runner's stopped flag.
   */
  private async runWorker(
    isStopped: () => boolean = () => this.stopped,
  ): Promise<void> {
    while (!isStopped()) {
      // Check for early exit conditions before making requests
      if (this.shouldEarlyExit()) {
        this.stop();
        return;
      }

      // Calculate optimal concurrency for this worker
      const requestsToMake = this.calculateOptimalConcurrency();

      // Select random requests for this batch
      const batchRequests = Array.from(
        { length: requestsToMake },
        () => this.requests[Math.floor(Math.random() * this.requests.length)],
      );

      // Execute all requests concurrently
      const requestPromises = batchRequests.map((req) =>
        this.makeSingleRequest(req),
      );
      const results = await Promise.allSettled(requestPromises);

      // Process all results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          this.onResult(result.value);
        } else {
          // Handle rejected promises (shouldn't normally happen with our implementation)
          const errorResult = this.getResultObject();
          errorResult.method = 'GET';
          errorResult.url = 'unknown';
          errorResult.status = 0;
          errorResult.latencyMs = 0;
          errorResult.success = false;
          errorResult.error = result.reason?.toString() || 'Unknown error';
          errorResult.timestamp = performance.now();
          this.onResult(errorResult);
        }
      }

      // Check for early exit conditions after processing all results
      if (this.shouldEarlyExit()) {
        this.stop();
        return;
      }

      // Rate limiting using TokenBucketManager
      if (this.currentTargetRps > 0) {
        // Instead of global sleep, each request will use per-endpoint rate limiting
        // in makeSingleRequest(). This allows different endpoints to have different
        // rate limits while eliminating the global blocking delay.
        // The token bucket approach is non-blocking and more efficient.

        // Small yield to prevent event loop starvation
        await sleep(0);
      } else {
        // If no RPS is set, yield to the event loop
        await sleep(0);
      }
    }
  }
}
