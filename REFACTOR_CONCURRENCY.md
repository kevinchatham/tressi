# Tressi Rate Limiting Architecture Refactor

## Problem Statement

The current Tressi implementation exhibits a critical flaw in its rate limiting architecture, causing massive overshooting of configured RPS limits. In testing with a configuration specifying 1 RPS for `/health` and 10 RPS for `/success`, the system fired off **1177 requests instead of the expected 110 requests** over 10 seconds.

## Root Cause Analysis

### The Fundamental Flaw

The issue lies in the **worker calculation logic** within [`src/core/execution-engine.ts:97-99`](src/core/execution-engine.ts:97-99):

```typescript
private calculateTotalWorkers(): number {
  return this.config.requests.reduce((sum, req) => sum + (req.rps || 1), 0);
}
```

### Why This Design Fails

1. **Worker Count = Sum of All RPS Values**: For your configuration (1 RPS + 10 RPS), this creates **11 workers**
2. **Independent Worker Execution**: Each worker runs autonomously without coordination
3. **Race Conditions**: Multiple workers can hit the same endpoint simultaneously
4. **No Rate Limit Enforcement**: Workers make requests as fast as possible, ignoring per-endpoint limits
5. **Thundering Herd Problem**: The number of concurrent requestors equals the sum of desired rates

### Critical Realization: Workers Are Fluff

**Analysis confirms that the current worker architecture is not just flawed—it's fundamentally unnecessary fluff that distracts from proper rate limiting.**

- **Vestigial Code**: [`src/workers/worker-controller.ts:143-146`](src/workers/worker-controller.ts:143-146) shows rate limiting is handled by "GlobalRequestScheduler"
- **Deprecated Components**: [`src/core/core-runner.ts:44`](src/core/core-runner.ts:44) explicitly states "WorkerPool is no longer needed"
- **Zero Benefits**: Current workers provide no value beyond the broken rate limiting they were meant to implement

### Current Architecture Flow

```
Config: 1 RPS + 10 RPS = 11 RPS total
↓
System creates 11 workers
↓
Each worker runs independently
↓
Workers select "ready" endpoints without coordination
↓
Massive overshooting (1177 requests vs 110 expected)
```

## Corrected Architecture Design

### Core Principle: Eliminate Worker-Based Rate Limiting

Replace the "many workers, no coordination" model with **direct centralized rate limiting** that eliminates workers entirely from rate calculations.

### New Architecture Components

#### 1. Centralized Rate Limiter (Replaces Workers)

- **Per-endpoint timing controllers** with millisecond precision
- **Single coordinator** that tracks exact timing for each endpoint
- **Direct request scheduling** without worker intermediaries
- **Thread-safe** timing and queue management

#### 2. Adaptive Concurrency Manager (Replaces Fixed Execution Pool)

- **Dynamic async operation limits** based on real-time system metrics
- **Event loop lag monitoring** to prevent saturation
- **Memory pressure detection** for resource-aware scaling
- **CPU usage tracking** for load-based adjustments
- **No fixed thread count** - adapts to actual system capacity

#### 3. Request Scheduler

- **Priority queue** based on next allowed request time per endpoint
- **Precise timing control** down to millisecond accuracy
- **Fair distribution** across endpoints with different RPS targets
- **Direct execution** without worker coordination overhead

### New Architecture Flow

```
Config: 1 RPS + 10 RPS
↓
Create adaptive concurrency manager (monitors system health)
↓
Central scheduler tracks per-endpoint timing
↓
Async operations request next ready endpoint based on system capacity
↓
Scheduler enforces exact RPS rates while respecting system limits
↓
Precise 110 requests over 10 seconds
```

## Implementation Plan

### Phase 1: Remove Worker-Based Architecture

- [x] **Analysis Complete**: Confirmed workers are fluff
- [ ] Eliminate `calculateTotalWorkers()` method
- [ ] Remove `WorkerController` and `ConcurrencyCalculator` classes
- [ ] Delete `src/workers/` directory entirely
- [ ] Create adaptive concurrency manager with dynamic limits

### Phase 2: Implement Centralized Rate Limiter

- [ ] Create `RateLimiter` class with per-endpoint tracking
- [ ] Implement timing-based limiting (microsecond precision)
- [ ] Add thread-safe request scheduling
- [ ] Create endpoint priority queue

### Phase 3: Implement Adaptive Concurrency

- [ ] Create `AdaptiveConcurrencyManager` class
- [ ] Add event loop lag monitoring
- [ ] Implement memory pressure detection
- [ ] Add CPU usage tracking
- [ ] Create dynamic adjustment algorithms

### Phase 4: Refactor Execution Architecture

- [ ] Replace worker loops with async execution functions
- [ ] Implement direct scheduler integration
- [ ] Add precise timing coordination
- [ ] Remove all worker-related event emissions

### Phase 5: Testing & Validation

- [ ] Create comprehensive tests for exact RPS enforcement
- [ ] Add edge case testing (very low/high RPS)
- [ ] Validate multi-endpoint scenarios
- [ ] Performance regression testing
- [ ] Test adaptive concurrency under load

## Technical Details

### Current Implementation (Flawed - Workers as Fluff)

```typescript
// Creates 11 workers for 1+10 RPS - BROKEN
const totalWorkers = config.requests.reduce(
  (sum, req) => sum + (req.rps || 1),
  0,
);
```

### Proposed Implementation (Corrected - No Workers)

```typescript
// Direct centralized rate limiting with adaptive concurrency
const rateLimiter = new CentralizedRateLimiter(config.requests);
const concurrencyManager = new AdaptiveConcurrencyManager();
```

### Rate Limiter Design (Replaces Workers)

```typescript
class CentralizedRateLimiter {
  private endpointLimits: Map<string, RateLimitTracker>;

  getNextReadyEndpoint(): string | null {
    // Returns which endpoint can make a request NOW
    // Enforces exact RPS timing per endpoint
    // No worker coordination needed
  }
}
```

### Adaptive Concurrency Manager (Replaces Fixed Threads)

```typescript
class AdaptiveConcurrencyManager {
  private currentConcurrency = 2;
  private targetLatency = 100; // ms
  private maxMemoryUsage = 0.8; // 80% of available

  async calculateOptimalConcurrency(): Promise<number> {
    const metrics = await this.getSystemMetrics();

    // Event loop lag - most critical indicator
    const eventLoopLag = await this.measureEventLoopLag();
    if (eventLoopLag > 50) return Math.max(1, this.currentConcurrency - 1);

    // Memory pressure
    const memoryUsage = process.memoryUsage();
    const heapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    if (heapRatio > this.maxMemoryUsage)
      return Math.max(1, this.currentConcurrency - 1);

    // Request latency feedback
    const avgLatency = await this.getAverageLatency();
    if (avgLatency < this.targetLatency * 0.8) {
      return Math.min(this.currentConcurrency + 1, 10); // Conservative max
    }

    return this.currentConcurrency;
  }

  private async measureEventLoopLag(): Promise<number> {
    const start = process.hrtime.bigint();
    await new Promise((resolve) => setImmediate(resolve));
    return Number(process.hrtime.bigint() - start) / 1000000;
  }
}
```

### Async Execution Design (Replaces Workers)

```typescript
class AsyncRequestExecutor {
  async run(
    rateLimiter: CentralizedRateLimiter,
    concurrencyManager: AdaptiveConcurrencyManager,
  ): Promise<void> {
    const activeRequests = [];

    while (shouldContinue()) {
      const optimalConcurrency =
        await concurrencyManager.calculateOptimalConcurrency();
      const endpoint = rateLimiter.getNextReadyEndpoint();

      if (endpoint && activeRequests.length < optimalConcurrency) {
        activeRequests.push(this.executeRequest(endpoint));
      } else if (activeRequests.length > 0) {
        // Wait for any request to complete
        await Promise.race(activeRequests);
        activeRequests.splice(
          activeRequests.findIndex((r) => r.done),
          1,
        );
      } else {
        await this.waitForNextEndpoint();
      }
    }
  }
}
```

## Expected Outcomes

- **Exact RPS enforcement**: 1 RPS endpoint = exactly 10 requests in 10 seconds
- **No overshooting**: Total requests = sum(RPS × duration) ± small tolerance
- **Simplified architecture**: Eliminates complex worker management
- **Resource efficient**: Dynamic concurrency based on actual system capacity
- **Self-tuning**: Adapts to different hardware and load conditions
- **Event loop protection**: Prevents saturation through intelligent monitoring
- **Predictable behavior**: Linear scaling with configured RPS values
- **Reduced complexity**: Removes unnecessary worker abstractions

## Migration Strategy

1. **Feature flag**: Implement new architecture behind configuration flag
2. **Gradual rollout**: Test with single endpoint, then multiple
3. **Performance validation**: Ensure no regression in throughput/latency
4. **Adaptive testing**: Validate dynamic concurrency under various loads
5. **Complete migration**: Remove all worker-based code once validated
6. **Code cleanup**: Delete vestigial worker classes and related code

## Code Cleanup Checklist

- [ ] Remove `src/workers/` directory entirely
- [ ] Remove worker-related imports and dependencies
- [ ] Update validation logic to remove worker count warnings
- [ ] Update UI components to remove worker count displays
- [ ] Update documentation to reflect simplified architecture
- [ ] Add adaptive concurrency configuration options
- [ ] Create monitoring endpoints for concurrency metrics

## Detailed File Impact Analysis

### Files to be **REMOVED** (Complete Deletion)

**Directory to Remove:**

- [`src/workers/`](src/workers/) - **Entire directory and all contents**
  - [`src/workers/worker-controller.ts`](src/workers/worker-controller.ts:1-171)
  - [`src/workers/concurrency-calculator.ts`](src/workers/concurrency-calculator.ts:1-213)
  - [`src/workers/index.ts`](src/workers/index.ts:1-10)

**Test Files to Remove:**

- [`tests/unit/workers/concurrency-calculator.test.ts`](tests/unit/workers/concurrency-calculator.test.ts) - Remove entire file
- [`tests/unit/workers/`](tests/unit/workers/) - **Entire directory**

### Files to be **CHANGED** (Significant Modifications)

#### Core Architecture Files

1. **[`src/core/execution-engine.ts`](src/core/execution-engine.ts:1-277)**
   - **Remove:** [`calculateTotalWorkers()`](src/core/execution-engine.ts:97-99) method
   - **Remove:** Worker-based execution model ([`startWorker()`](src/core/execution-engine.ts:101-124), [`executeWorkerIteration()`](src/core/execution-engine.ts:126-157))
   - **Replace with:** Centralized rate limiter and adaptive concurrency manager
   - **Update:** Constructor and initialization logic

2. **[`src/core/core-runner.ts`](src/core/core-runner.ts:1-317)**
   - **Remove:** Worker pool references and worker management ([`addWorker()`](src/core/core-runner.ts:86-93))
   - **Update:** [`getWorkerPool()`](src/core/core-runner.ts:266-268) method to return null/undefined
   - **Remove:** Worker-related event emissions
   - **Update:** Configuration validation to remove worker count warnings

3. **[`src/validation/rate-limit-validator.ts`](src/validation/rate-limit-validator.ts:1-184)**
   - **Remove:** Worker count validation logic ([`validateOverallConfig`](src/validation/rate-limit-validator.ts:69-111) lines 85-110)
   - **Remove:** Worker count recommendations ([`getRecommendations`](src/validation/rate-limit-validator.ts:118-141) lines 129-138)
   - **Update:** Remove worker-related warnings and recommendations

#### Configuration Impact

- **Remove:** `workers` field from configuration options in [`src/config.ts`](src/config.ts:1-196)
- **Update:** Configuration schema to remove worker-related validation

### Test Files to be **UPDATED**

#### E2E Test Files - Remove Worker Configuration

1. **[`tests/e2e/rate-limiting.test.ts`](tests/e2e/rate-limiting.test.ts)**
   - **Remove:** All `workers: X` configurations (lines 31-32, 57-58, 87-88, 116-117, 143-144, 171-172, 205-206, 238-239, 270-271, 304-305)

2. **[`tests/e2e/per-endpoint-rps.test.ts`](tests/e2e/per-endpoint-rps.test.ts)**
   - **Remove:** All `workers: X` configurations (lines 31-32, 73-74, 110-111, 137-138, 167-168, 194-195, 218-219, 243-244, 272-273, 305-306)

3. **[`tests/e2e/load-testing.test.ts`](tests/e2e/load-testing.test.ts)**
   - **Remove:** Worker scaling tests ([`should handle worker scaling`](tests/e2e/load-testing.test.ts:269-284))
   - **Remove:** All `workers: X` configurations

4. **[`tests/e2e/rate-limiting-benchmarks.test.ts`](tests/e2e/rate-limiting-benchmarks.test.ts)**
   - **Remove:** All `workers: X` configurations

5. **[`tests/e2e/memory-profile.test.ts`](tests/e2e/memory-profile.test.ts)**
   - **Remove:** All `workers: X` configurations

6. **[`tests/e2e/cli-commands.test.ts`](tests/e2e/cli-commands.test.ts)**
   - **Remove:** Worker configuration assertions (lines 55-56, 74-76)

#### Integration Test Files

7. **[`tests/integration/runner.test.ts`](tests/integration/runner.test.ts)**
   - **Remove:** Worker scaling tests ([`should scale workers to meet target RPS`](tests/integration/runner.test.ts:75-107))
   - **Remove:** Worker count assertions ([`getWorkerPool().getWorkerCount()`](tests/integration/runner.test.ts:101))
   - **Remove:** All `workers: X` configurations

8. **[`tests/integration/config.test.ts`](tests/integration/config.test.ts)**
   - **Remove:** Worker configuration from test configs (lines 10-11, 23-24, 102-103)

9. **[`tests/integration/optimization.test.ts`](tests/integration/optimization.test.ts)**
   - **Remove:** Worker configurations and concurrency/thread safety tests

10. **[`tests/integration/headers.test.ts`](tests/integration/headers.test.ts)**
    - **Remove:** Worker configurations

11. **[`tests/integration/early-exit.test.ts`](tests/integration/early-exit.test.ts)**
    - **Remove:** Worker configurations

#### Unit Test Files

12. **[`tests/unit/validation/config-validator.test.ts`](tests/unit/validation/config-validator.test.ts)**
    - **Update:** Remove worker-related test cases

13. **[`tests/unit/cli/commands/*.test.ts`](tests/unit/cli/commands/)**
    - **Update:** Remove worker configurations from test fixtures

14. **[`tests/unit/reporting/summarizer.test.ts`](tests/unit/reporting/summarizer.test.ts)**
    - **Update:** Remove worker configurations

### New Files to be **CREATED**

Based on the REFACTOR_CONCURRENCY.md plan, these new components need to be created:

1. **Centralized Rate Limiter**
   - `src/core/rate-limiter.ts` - New file for per-endpoint timing control
   - `src/core/endpoint-rate-tracker.ts` - Individual endpoint rate tracking

2. **Adaptive Concurrency Manager**
   - `src/core/adaptive-concurrency-manager.ts` - Dynamic concurrency based on system metrics
   - `src/core/system-metrics.ts` - Event loop lag, memory, CPU monitoring

3. **Async Request Executor**
   - `src/core/async-request-executor.ts` - Replaces worker loops with async execution

4. **New Test Files**
   - `tests/unit/core/rate-limiter.test.ts` - Test exact RPS enforcement
   - `tests/unit/core/adaptive-concurrency-manager.test.ts` - Test dynamic concurrency
   - `tests/e2e/exact-rps-enforcement.test.ts` - Validate precise rate limiting
   - `tests/e2e/adaptive-concurrency.test.ts` - Test system adaptation

### Configuration Schema Updates

**Required Changes:**

- **Remove:** `workers` field from configuration options
- **Add:** New adaptive concurrency configuration options:
  - `maxConcurrency`: Maximum concurrent operations
  - `targetLatency`: Target response latency for adaptation
  - `memoryThreshold`: Memory usage threshold
  - `enableAdaptiveConcurrency`: Feature flag

### Migration Strategy Files

**Files to create for gradual migration:**

- `src/core/feature-flags.ts` - Feature flag system for new architecture
- `src/core/migration-guide.md` - Documentation for users
- `src/core/deprecation-warnings.ts` - Warnings for deprecated worker configs

This analysis provides a complete roadmap for implementing the concurrency refactor, eliminating the flawed worker-based architecture in favor of centralized rate limiting with adaptive concurrency as outlined in this document.
