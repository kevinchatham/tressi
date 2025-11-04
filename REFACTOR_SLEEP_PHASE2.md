# Phase 2 Implementation Plan - Rate Limiting Refactor Completion

## 🎯 Overview

Phase 2 completes the rate limiting refactor by removing legacy components, validating the new token bucket implementation, and establishing comprehensive performance benchmarks. This phase transitions from the hybrid state (Phase 1) to a fully optimized, production-ready rate limiting system.

## 📊 Phase 1 Status Summary

**✅ COMPLETED:**

- Token bucket algorithm implementation
- Per-endpoint rate limiting architecture
- Non-blocking micro-delay system
- Comprehensive unit tests (300+ lines)
- Backward compatibility maintained

## 🎯 Phase 2 Objectives

### Primary Goals

1. **Complete Migration**: Remove legacy RateLimiter classes
2. **Test Integration**: Verify per-endpoint functionality
3. **Clean Architecture**: Remove all sleep-based limiting code

## 🔧 Technical Implementation Plan

### Week 1: Testing & Validation

#### Day 1-2: Per-Endpoint Configuration Testing

- **Task**: Validate per-endpoint RPS configuration
- **Files to test**:
  - [`src/core/runner/endpoint-rate-limiter.ts`](src/core/runner/endpoint-rate-limiter.ts)
  - [`src/core/runner/endpoint-rate-limiter-manager.ts`](src/core/runner/endpoint-rate-limiter-manager.ts)
- **Test scenarios**:
  - Mixed global/per-endpoint configurations
  - Dynamic RPS changes during execution
  - Edge cases (zero RPS, very high RPS)

#### Day 3-4: End-to-End Tests with Programmatic Interface

- **Task**: Create comprehensive e2e test suite using programmatic API
- **New test files**:
  - `tests/e2e/rate-limiting.test.ts`
  - `tests/e2e/per-endpoint-rps.test.ts`
- **Test approach**: Use real TressiRunner instance with actual HTTP endpoints
- **Test coverage**:
  - Multi-endpoint concurrent requests with real execution
  - Rate limiting accuracy (±1% tolerance) with actual timing
  - Configuration changes via programmatic interface
  - Error handling with real HTTP scenarios
  - No mocked dependencies - full system testing

#### Day 5: Performance Baseline Establishment

- **Task**: Create performance benchmark suite
- **New benchmark files**:
  - `tests/performance/rate-limiting-benchmarks.ts`
  - `tests/performance/memory-profile.test.ts`
- **Benchmark scenarios**:
  - 10 endpoints @ 100 RPS each
  - 100 endpoints @ 10 RPS each
  - Mixed endpoint configurations
  - Long-running stability (1M+ requests)

### Week 2: Legacy Code Removal & Optimization

#### Day 1-2: Remove Legacy RateLimiter

- **Files to modify**:
  - [`src/core/runner/rate-limiter.ts`](src/core/runner/rate-limiter.ts) - Remove old classes
  - [`src/core/runner/execution-engine.ts`](src/core/runner/execution-engine.ts) - Final cleanup
- **Verification**: Ensure no references to legacy classes remain

#### Day 3-4: WorkerController Optimization

- **Files to optimize**:
  - [`src/workers/worker-controller.ts`](src/workers/worker-controller.ts) - Remove sleep-based code
- **Tasks**:
  - Remove `applyRateLimiting()` method entirely
  - Optimize token acquisition patterns
  - Add telemetry for rate limiting metrics

#### Day 5: Memory & Resource Optimization

- **Tasks**:
  - Profile memory usage patterns
  - Optimize token bucket storage
  - Add resource monitoring hooks

### Week 3: Documentation & Release Preparation

#### Day 1-2: Documentation Updates

- **Files to update**:
  - `README.md` - Add rate limiting examples
  - `docs/` - Create rate limiting guide
  - `tressi.config.json` examples - Add per-endpoint RPS samples
- **Documentation sections**:
  - Configuration reference
  - Performance tuning guide

#### Day 3-4: CLI & Configuration Enhancement

- **Files to enhance**:
  - [`src/cli/commands/run-command.ts`](src/cli/commands/run-command.ts) - Add CLI options
  - [`src/core/validation/config-validator.ts`](src/core/validation/config-validator.ts) - Enhanced validation
- **New features**:
  - Configuration validation warnings
  - Performance recommendations

#### Day 5: Release Preparation

- **Tasks**:
  - Final regression testing
  - Performance report generation

## 🧪 Testing Strategy

### E2E Testing with Programmatic Interface

The testing strategy focuses on **real-world validation** using Tressi's programmatic API rather than mocked dependencies. This approach ensures:

- **Real HTTP traffic** with actual network conditions
- **Authentic timing measurements** without artificial delays
- **Genuine resource usage** patterns
- **Production-like scenarios** with real endpoints

### E2E Testing with server.ts

The existing `server.ts` provides a comprehensive test server with endpoints specifically designed for rate limiting validation:

```typescript
// tests/e2e/rate-limiting.test.ts
import { TressiRunner } from '../../src/index';
import { spawn } from 'child_process';
import { getPortPromise } from 'portfinder';

describe('Rate Limiting E2E Tests with server.ts', () => {
  let serverProcess: any;
  let baseUrl: string;

  beforeAll(async () => {
    const port = await getPortPromise();
    serverProcess = spawn('node', ['server.ts', `--port=${port}`], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    baseUrl = `http://localhost:${port}`;
    await waitForServerReady(serverProcess);
  });

  afterAll(() => {
    serverProcess.kill();
  });

  describe('Per-endpoint RPS validation', () => {
    it('should enforce rate limits across server.ts endpoints', async () => {
      const runner = new TressiRunner({
        endpoints: [
          { url: `${baseUrl}/success`, rps: 10 },
          { url: `${baseUrl}/delay/100`, rps: 5 },
          { url: `${baseUrl}/payload/1`, rps: 8 },
        ],
        duration: '30s',
        workers: 4,
      });

      const results = await runner.run();
      expect(results.metrics.rps).toBeWithin(22, 24); // 10+5+8=23 expected
    });
  });
});
```

### server.ts Endpoint Utilization for Rate Limiting Tests

| Endpoint         | Purpose in Rate Limiting Tests                                 |
| ---------------- | -------------------------------------------------------------- |
| `/success`       | Fast responses for high RPS testing (immediate 200)            |
| `/delay/:ms`     | Controlled latency for timing validation (configurable delays) |
| `/payload/:size` | Variable response sizes for memory testing (1-100KB)           |
| `/status/429`    | Rate limit simulation testing                                  |
| `/rate-limit`    | Built-in rate limiting behavior (30% chance of 429)            |
| `/timeout`       | Timeout scenario testing (never responds)                      |
| `/metrics`       | Server-side metrics validation                                 |

### Test Server Management

```typescript
// tests/e2e/utils/server-manager.ts
import { spawn, ChildProcess } from 'child_process';
import { getPortPromise } from 'portfinder';

export class ServerManager {
  private process: ChildProcess | null = null;
  private port: number = 0;

  async start(): Promise<string> {
    this.port = await getPortPromise();

    this.process = spawn('node', ['server.ts', `--port=${this.port}`], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    await this.waitForReady();
    return `http://localhost:${this.port}`;
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Server startup timeout')),
        10000,
      );

      this.process?.stdout?.on('data', (data) => {
        if (data.toString().includes('running at')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }
}
```

````

### Load Testing Matrix (E2E Focus)

| Configuration          | Duration | Expected RPS     | Tolerance | Test Type |
| ---------------------- | -------- | ---------------- | --------- | --------- |
| 10 endpoints @ 50 RPS  | 5 min    | 500 total        | ±2%       | Real HTTP |
| 50 endpoints @ 20 RPS  | 10 min   | 1000 total       | ±2%       | Real HTTP |
| 100 endpoints @ 10 RPS | 15 min   | 1000 total       | ±2%       | Real HTTP |
| Mixed (10-100 RPS)     | 20 min   | Config dependent | ±3%       | Real HTTP |

### Performance Benchmarks (E2E Focus)

- **Baseline**: Current sleep-based implementation with real HTTP
- **Target**: 5x improvement in concurrent scenarios with actual endpoints
- **Metrics**: RPS, latency, CPU utilization, memory usage with real load
- **Tools**: Vitest benchmarks, Node.js performance hooks, programmatic API
- **Approach**: Use TressiRunner programmatically with test HTTP servers

## 🧹 Migration & Cleanup

### Legacy Code Removal Checklist

- [ ] Remove `RateLimiter` class from [`src/core/runner/rate-limiter.ts`](src/core/runner/rate-limiter.ts)
- [ ] Remove `TokenBucketRateLimiter` class (if superseded)
- [ ] Remove sleep-based methods from [`src/workers/worker-controller.ts`](src/workers/worker-controller.ts)
- [ ] Update all imports and references
- [ ] Remove deprecated configuration options

### File Cleanup

```bash
# Files to be removed/modified
src/core/runner/rate-limiter.ts     # Remove legacy classes
tests/unit/core/runner/rate-limiter.test.ts  # Remove/update tests
tests/integration/rate-limiting.test.ts  # Replaced by e2e tests
tests/integration/per-endpoint-rps.test.ts  # Replaced by e2e tests
````

### Configuration Migration

- **Backward compatibility**: Maintained through Phase 1
- **New features**: Per-endpoint RPS configuration
- **Deprecated**: Global-only RPS (still supported but not recommended)

## 📈 Performance Validation

### Benchmark Suite Structure (E2E Focus with server.ts)

```
tests/e2e/
├── rate-limiting.test.ts           # Core rate limiting e2e tests using server.ts
├── per-endpoint-rps.test.ts        # Per-endpoint configuration tests
├── performance.test.ts             # Performance benchmarks with server.ts
├── server-manager.ts               # server.ts lifecycle management
└── fixtures/
    └── server-configs.ts          # Test server configurations

tests/performance/
├── memory-profile.test.ts          # Memory usage analysis with real load
├── regression.test.ts              # Performance regression
└── baselines.json                  # Updated baselines
```

### Key Performance Indicators

| Metric          | Phase 1 Target | Phase 2 Target | Validation Method   |
| --------------- | -------------- | -------------- | ------------------- |
| 10-worker RPS   | 17,500         | 17,500+        | Automated benchmark |
| 100-worker RPS  | 150,000        | 150,000+       | Load test           |
| Memory overhead | <20%           | <15%           | Memory profiling    |
| CPU utilization | ~80%           | 80-85%         | System monitoring   |

## 🚨 Risk Mitigation

### High-Risk Areas

1. **Configuration compatibility** - Mitigated by backward compatibility layer
2. **Performance regression** - Mitigated by comprehensive benchmarks
3. **Memory leaks** - Mitigated by profiling and cleanup mechanisms

### Rollback Plan

1. **Feature flags**: Enable/disable new rate limiting via configuration
2. **Version tagging**: Git tags for easy rollback
3. **Performance alerts**: Automated regression detection

## 📋 Phase 2 Completion Checklist

### Technical Completion

- [ ] All legacy RateLimiter classes removed
- [ ] Per-endpoint RPS fully tested and validated
- [ ] Performance benchmarks meet 5x improvement target
- [ ] Memory usage within acceptable limits
- [ ] All integration tests passing

### Documentation & Release

- [ ] README.md updated with new examples
- [ ] Migration guide completed
- [ ] Performance report generated
- [ ] CLI documentation updated
- [ ] Version changelog prepared

### Quality Assurance

- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance regression tests passing
- [ ] Load testing successful
- [ ] User acceptance testing completed

## 🎯 Expected Outcomes

### Immediate Benefits

- **5x performance improvement** in concurrent scenarios
- **Per-endpoint rate limiting** for fine-grained control
- **Elimination of all sleep-based delays**
- **Improved resource utilization**

### Long-term Benefits

- **Scalable architecture** for future enhancements
- **Reduced operational costs** through efficiency
- **Enhanced user experience** with faster execution
- **Foundation for advanced features** (dynamic RPS, monitoring)

## 📅 Timeline Summary

| Week   | Focus               | Key Deliverables                   |
| ------ | ------------------- | ---------------------------------- |
| Week 1 | Integration Testing | Test suites, validation, bug fixes |
| Week 2 | Legacy Removal      | Clean architecture, optimization   |
| Week 3 | Documentation       | Guides, release preparation        |

## 🔗 Related Resources

- **Phase 1 Summary**: [REFACTOR_SLEEP_PHASE1_IMPLEMENTATION_SUMMARY.md](REFACTOR_SLEEP_PHASE1_IMPLEMENTATION_SUMMARY.md)
- **Original Plan**: [REFACTOR_SLEEP.md](REFACTOR_SLEEP.md)
- **Code Location**: `src/core/runner/` directory
- **Test Location**: `tests/unit/core/runner/` and `tests/e2e/` (for programmatic interface testing)

---

**Next Step**: Begin Week 1 with per-endpoint configuration testing and integration validation.
