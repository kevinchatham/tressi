import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import { RequestExecutor } from '../../request/request-executor';
import { ResponseSampler } from '../../request/response-sampler';
import { ResultAggregator } from '../../stats/aggregators/result-aggregator';
import { RpsCalculator } from '../../stats/calculators/rps-calculator';
import type {
  RequestResult,
  SafeTressiConfig,
  TressiOptionsConfig,
} from '../../types';
import { globalResourceManager } from '../../utils/resource-manager';
import { WorkerPool } from '../../workers/worker-pool';
import { ConfigValidator } from '../validation/config-validator';
import { ExecutionEngine } from './execution-engine';

/**
 * Core orchestration component for the Tressi load testing tool.
 * This class coordinates between all specialized components and manages the test lifecycle.
 */
export class CoreRunner extends EventEmitter {
  private config: SafeTressiConfig;
  private options: TressiOptionsConfig;
  private configValidator: ConfigValidator;
  private resultAggregator: ResultAggregator;
  private rpsCalculator: RpsCalculator;
  private workerPool: WorkerPool;
  private requestExecutor: RequestExecutor;
  private responseSampler: ResponseSampler;
  private executionEngine: ExecutionEngine;
  private startTime: number = 0;
  private stopped = false;

  /**
   * Creates a new CoreRunner instance.
   * @param config The Tressi configuration
   */
  constructor(config: SafeTressiConfig) {
    super();

    this.config = config;
    this.configValidator = new ConfigValidator();

    // Validate configuration with early exit options
    this.options = this.configValidator.validateEarlyExitOptions(
      config.options,
    );

    // Initialize components in correct order
    this.workerPool = new WorkerPool(this.options.workers ?? 10);
    this.responseSampler = new ResponseSampler();
    this.requestExecutor = new RequestExecutor(
      this.responseSampler,
      1000, // Default max pool size
    );
    this.resultAggregator = new ResultAggregator(
      this.options.useUI ?? true,
      1000, // Default max sample size
    );
    this.rpsCalculator = new RpsCalculator(this.options.rps ?? 1000);
    this.executionEngine = new ExecutionEngine(this);

    // Set up event forwarding
    this.setupEventForwarding();
    this.setupExecutionEngineIntegration();
  }

  /**
   * Sets up event forwarding between components.
   */
  private setupEventForwarding(): void {
    // Forward worker pool events
    this.workerPool.on('workerAdded', (count) => {
      this.emit('workerAdded', count);
    });

    this.workerPool.on('workerRemoved', (count) => {
      this.emit('workerRemoved', count);
    });

    this.workerPool.on('allWorkersStopped', (count) => {
      this.emit('allWorkersStopped', count);
    });
  }

  /**
   * Sets up execution engine integration.
   */
  private setupExecutionEngineIntegration(): void {
    // Handle worker requests from execution engine
    this.executionEngine.on('addWorkerRequested', () => {
      this.addWorker();
    });

    this.executionEngine.on('removeWorkerRequested', () => {
      this.removeWorker();
    });

    // Forward execution engine events
    this.executionEngine.on('executionStarted', (data) => {
      this.emit('executionStarted', data);
    });

    this.executionEngine.on('executionStopped', (data) => {
      this.emit('executionStopped', data);
    });

    this.executionEngine.on('rampUpProgress', (data) => {
      this.emit('rampUpProgress', data);
    });

    this.executionEngine.on('autoscaling', (data) => {
      this.emit('autoscaling', data);
    });
  }

  /**
   * Adds a new worker to the pool.
   */
  private addWorker(): void {
    let workerStopped = false;
    const stop = (): void => {
      workerStopped = true;
    };

    const workerFunction = this.executionEngine.createWorkerFunction(
      () => workerStopped,
    );
    const promise = workerFunction();

    this.workerPool.addWorker(() => ({ promise, stop }));
  }

  /**
   * Removes a worker from the pool.
   */
  private removeWorker(): void {
    this.workerPool.removeWorker();
  }

  /**
   * Starts the load test execution.
   * This is the main entry point that coordinates all components.
   */
  public async run(): Promise<void> {
    this.startTime = performance.now();
    this.stopped = false;

    try {
      // Emit start event
      this.emit('start', {
        config: this.config,
        startTime: this.startTime,
      });

      // Register resources for cleanup
      this.registerResources();

      // Start the execution engine
      await this.executionEngine.start();

      // Add initial worker
      this.addWorker();

      // Wait for completion or stop signal
      await this.waitForCompletion();

      // Emit completion event
      this.emit('complete', {
        duration: performance.now() - this.startTime,
        totalRequests: this.resultAggregator.getTotalRequestsCount(),
        successfulRequests: this.resultAggregator.getSuccessfulRequestsCount(),
        failedRequests: this.resultAggregator.getFailedRequestsCount(),
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Registers resources for automatic cleanup.
   */
  private registerResources(): void {
    // Register request executor pools
    globalResourceManager.registerResource('request-executor-pools', {
      cleanup: () => {
        this.requestExecutor.clearPools();
        this.responseSampler.clear();
      },
    });

    // Register result aggregator - don't clear it here, we need results for reporting
    // The clear() method will be called manually when needed (e.g., for reuse)
    globalResourceManager.registerResource('result-aggregator', {
      cleanup: () => {
        // Don't clear the result aggregator - results are needed for reporting
        // this.resultAggregator.clear();
      },
    });
  }

  /**
   * Waits for test completion or stop signal.
   */
  private async waitForCompletion(): Promise<void> {
    const { durationSec = 10 } = this.config.options;
    const maxDurationMs = (durationSec + 5) * 1000; // Add buffer for cleanup

    return new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let timeoutId: NodeJS.Timeout;

      // Set up timeout handler
      const timeoutHandler = (): void => {
        this.stop();
        resolve();
      };

      // Set up stop handler
      const stopHandler = (): void => {
        clearTimeout(timeoutId);
        this.cleanup();
        resolve();
      };

      // Set up error handler
      const errorHandler = (error: Error): void => {
        clearTimeout(timeoutId);
        this.cleanup();
        reject(error);
      };

      // Set maximum execution timeout
      timeoutId = setTimeout(timeoutHandler, maxDurationMs);

      this.once('stop', stopHandler);
      this.once('error', errorHandler);

      // Wait for all workers to complete
      this.workerPool
        .waitForAllWorkers()
        .then(() => {
          clearTimeout(timeoutId);
          this.removeListener('stop', stopHandler);
          this.removeListener('error', errorHandler);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          this.removeListener('stop', stopHandler);
          this.removeListener('error', errorHandler);
          reject(error);
        });
    });
  }

  /**
   * Stops the test execution.
   */
  public stop(): void {
    if (this.stopped) return;

    this.stopped = true;
    this.executionEngine.stop();
    this.workerPool.stopAllWorkers();
    this.emit('stop');
  }

  /**
   * Cleans up all resources.
   */
  private cleanup(): void {
    // Don't clear the result aggregator here - we need the results for reporting
    globalResourceManager.cleanupAll();
  }

  /**
   * Records a request result.
   * @param result The request result to record
   */
  public recordResult(result: RequestResult): void {
    this.resultAggregator.recordResult(result);
    this.rpsCalculator.recordRequest(result.timestamp);

    // Check for early exit conditions
    if (this.shouldEarlyExit()) {
      this.stop();
    }

    // Emit result event for UI updates
    this.emit('result', result);
  }

  /**
   * Checks if early exit conditions are met.
   * @returns true if early exit conditions are met
   */
  private shouldEarlyExit(): boolean {
    return this.resultAggregator.shouldEarlyExit(this.options);
  }

  /**
   * Gets the result aggregator for accessing statistics.
   * @returns The result aggregator instance
   */
  public getResultAggregator(): ResultAggregator {
    return this.resultAggregator;
  }

  /**
   * Gets the RPS calculator for accessing RPS statistics.
   * @returns The RPS calculator instance
   */
  public getRpsCalculator(): RpsCalculator {
    return this.rpsCalculator;
  }

  /**
   * Gets the worker pool for worker management.
   * @returns The worker pool instance
   */
  public getWorkerPool(): WorkerPool {
    return this.workerPool;
  }

  /**
   * Gets the request executor for making HTTP requests.
   * @returns The request executor instance
   */
  public getRequestExecutor(): RequestExecutor {
    return this.requestExecutor;
  }

  /**
   * Gets the execution engine.
   * @returns The execution engine instance
   */
  public getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Gets the configuration.
   * @returns The Tressi configuration
   */
  public getConfig(): SafeTressiConfig {
    return this.config;
  }

  /**
   * Gets the validated options.
   * @returns The validated options
   */
  public getOptions(): TressiOptionsConfig {
    return this.options;
  }

  /**
   * Gets the start time of the test.
   * @returns The start time as a Unix timestamp
   */
  public getStartTime(): number {
    return this.startTime;
  }

  /**
   * Checks if the test is stopped.
   * @returns true if the test is stopped
   */
  public isStopped(): boolean {
    return this.stopped;
  }
}
