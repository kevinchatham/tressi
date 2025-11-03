# Tressi Testing Strategy Refactor Plan - UPDATED

## Executive Summary

This document outlines a comprehensive plan to evolve the Tressi testing suite to leverage the newly refactored modular architecture. The goal is to create a maintainable, comprehensive testing strategy that includes unit tests, integration tests, and E2E tests while preserving existing functionality.

## Current State Analysis

### Existing Test Suite

- **11 test files** covering various aspects
- **Integration-heavy** with some unit tests
- **All tests passing** - valuable baseline
- **Mock-based** testing with undici and vitest

### Test Categories Identified

1. **Unit Tests**: `circular-buffer.test.ts`, `utils.test.ts`, `distribution.test.ts`
2. **Integration Tests**: `config.test.ts`, `exporter.test.ts`, `summarizer.test.ts`
3. **Feature Tests**: `early-exit.test.ts`, `headers.test.ts`, `optimization.test.ts`, `runner.test.ts`

## Strategic Approach

### Phase 1: Preserve & Augment (Keep Existing Tests)

- **DO NOT replace** existing tests - they provide valuable integration coverage
- **Augment** with focused unit tests for new modular components
- **Maintain** backward compatibility during transition
- **Leverage** existing test utilities and patterns

### Phase 2: New Test Architecture (Simplified Structure)

```
tests/
├── unit/                    # New unit tests (flat structure matching src/)
│   ├── core-runner.test.ts
│   ├── execution-engine.test.ts
│   ├── rate-limiter.test.ts
│   ├── config-validator.test.ts
│   ├── request-executor.test.ts
│   ├── request-factory.test.ts
│   ├── response-processor.test.ts
│   ├── worker-pool.test.ts
│   ├── worker-controller.test.ts
│   ├── latency-calculator.test.ts
│   ├── rps-calculator.test.ts
│   ├── csv-exporter.test.ts
│   ├── xlsx-exporter.test.ts
│   ├── html-generator.test.ts
│   ├── markdown-generator.test.ts
│   ├── cli-commands.test.ts
│   ├── config-display.test.ts
│   ├── latency-chart.test.ts
│   ├── stats-table.test.ts
│   ├── response-chart.test.ts
│   └── tui-manager.test.ts
├── integration/             # Existing tests (preserved)
│   ├── config.test.ts
│   ├── exporter.test.ts
│   ├── summarizer.test.ts
│   ├── cli-integration.test.ts
│   └── api-integration.test.ts
├── e2e/                    # New E2E tests using server.ts
│   ├── server.test.ts
│   ├── load-test.test.ts
│   ├── performance.test.ts
│   ├── security.test.ts
│   ├── cross-platform.test.ts
│   └── edge-cases.test.ts
├── fixtures/               # Test data and configurations
├── utils/                  # Test utilities and helpers (enhanced existing)
├── performance/            # Performance regression tests
└── setup/                  # Test configuration and setup
```

## Detailed Implementation Plan

### Week 1: Unit Test Foundation & CLI/UI Testing

- [ ] Create simplified unit test directory structure
- [ ] Add unit tests for core modules (CoreRunner, RateLimiter, ExecutionEngine)
- [ ] Implement CLI command tests (config, init, run commands)
- [ ] Add UI component tests (latency-chart, stats-table, response-chart)
- [ ] Enhance existing test utilities and fixtures
- [ ] Add configuration validation edge case tests

### Week 2: E2E Framework & Edge Cases

- [ ] Configure test server automation with proper lifecycle management
- [ ] Create comprehensive E2E test scenarios using server.ts
- [ ] Add performance regression tests with concrete baselines
- [ ] Implement edge case testing (network failures, config errors)
- [ ] Add security testing scenarios (auth, validation)

### Week 3: Security & Cross-Platform

- [ ] Implement cross-platform compatibility tests (Node.js 18/20/22)
- [ ] Organize existing integration tests in new structure
- [ ] Add CI/CD integration with test matrix
- [ ] Create comprehensive test documentation
- [ ] Establish performance baselines and monitoring

## Unit Test Examples (Updated)

### Core Runner Unit Test

```typescript
// tests/unit/core-runner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CoreRunner } from '../src/core/runner/core-runner';
import type { SafeTressiConfig } from '../src/types';

describe('CoreRunner', () => {
  it('should initialize with valid configuration', () => {
    const config: SafeTressiConfig = {
      $schema: 'https://example.com/schema.json',
      requests: [{ url: 'http://localhost:5000/test', method: 'GET' }],
      options: {
        workers: 1,
        durationSec: 1,
        rps: 10,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
      },
    };

    expect(() => new CoreRunner(config)).not.toThrow();
  });

  it('should emit events during execution', async () => {
    const config = createTestConfig();
    const runner = new CoreRunner(config);
    const onStart = vi.fn();

    runner.on('test:start', onStart);
    await runner.run();

    expect(onStart).toHaveBeenCalled();
  });
});
```

### Rate Limiter Unit Test

```typescript
// tests/unit/rate-limiter.test.ts
import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/core/runner/rate-limiter';

describe('RateLimiter', () => {
  it('should maintain target RPS', async () => {
    const limiter = new RateLimiter({ rps: 10 });
    const start = Date.now();

    for (let i = 0; i < 10; i++) {
      await limiter.waitForNext();
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(1100);
  });
});
```

### CLI Command Unit Test

```typescript
// tests/unit/cli-commands.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runCommand } from '../src/cli/commands/run-command';

describe('CLI Run Command', () => {
  it('should parse configuration file path correctly', async () => {
    const mockConfig = { requests: [], options: {} };
    const result = await runCommand({ config: 'test-config.json' });
    expect(result.configPath).toBe('test-config.json');
  });

  it('should handle missing configuration file', async () => {
    await expect(runCommand({ config: 'nonexistent.json' })).rejects.toThrow(
      'Configuration file not found',
    );
  });
});
```

### UI Component Unit Test

```typescript
// tests/unit/latency-chart.test.ts
import { describe, it, expect } from 'vitest';
import { renderLatencyChart } from '../src/ui/components/latency-chart';

describe('LatencyChart Component', () => {
  it('should render chart with valid data', () => {
    const data = [
      { percentile: 50, latency: 100 },
      { percentile: 95, latency: 250 },
      { percentile: 99, latency: 500 },
    ];

    const chart = renderLatencyChart(data);
    expect(chart).toContain('50th percentile: 100ms');
    expect(chart).toContain('95th percentile: 250ms');
  });

  it('should handle empty data gracefully', () => {
    const chart = renderLatencyChart([]);
    expect(chart).toBe('No latency data available');
  });
});
```

## E2E Testing with server.ts (Enhanced)

### Test Server Integration

```typescript
// tests/e2e/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { CoreRunner } from '../../src/core/runner/core-runner';
import type { SafeTressiConfig } from '../../src/types';

describe('E2E Testing with Test Server', () => {
  let server: any;

  beforeAll(async () => {
    server = spawn('node', ['server.ts'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: '5000' },
    });

    // Wait for server with health check
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Server timeout')),
        10000,
      );

      const checkServer = async () => {
        try {
          const response = await fetch('http://localhost:5000/health');
          if (response.ok) {
            clearTimeout(timeout);
            resolve();
          }
        } catch {
          setTimeout(checkServer, 500);
        }
      };
      checkServer();
    });
  });

  afterAll(() => {
    server?.kill('SIGTERM');
  });

  it('should handle mixed success/failure scenarios', async () => {
    const config: SafeTressiConfig = {
      $schema: 'https://example.com/schema.json',
      requests: [
        { url: 'http://localhost:5000/success', method: 'GET' },
        { url: 'http://localhost:5000/server-error', method: 'GET' },
        { url: 'http://localhost:5000/delay/50', method: 'GET' },
      ],
      options: {
        workers: 2,
        durationSec: 3,
        rps: 5,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
      },
    };

    const runner = new CoreRunner(config);
    await runner.run();

    const results = runner.getResultAggregator().getSampledResults();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.status === 200)).toBe(true);
    expect(results.some((r) => r.status === 500)).toBe(true);
  });
});
```

## Edge Case Testing (Enhanced)

### Network Failure Scenarios

```typescript
// tests/e2e/edge-cases/network-failures.test.ts
describe('Network Failure Handling', () => {
  it('should handle DNS resolution failures', async () => {
    const config = createTestConfig({
      requests: [{ url: 'http://nonexistent-domain-12345.com', method: 'GET' }],
    });

    const runner = new CoreRunner(config);
    await expect(runner.run()).resolves.not.toThrow();

    const results = runner.getResultAggregator().getSampledResults();
    expect(results.every((r) => !r.success)).toBe(true);
  });

  it('should handle connection timeouts', async () => {
    const config = createTestConfig({
      requests: [{ url: 'http://10.255.255.1', method: 'GET' }],
      options: { timeoutMs: 1000 },
    });

    const runner = new CoreRunner(config);
    await runner.run();

    const results = runner.getResultAggregator().getSampledResults();
    expect(results.some((r) => r.error?.includes('timeout'))).toBe(true);
  });
});
```

### Configuration Edge Cases

```typescript
// tests/unit/config-edge-cases.test.ts
describe('Configuration Edge Cases', () => {
  it('should handle zero workers gracefully', () => {
    const config = createTestConfig({ options: { workers: 0 } });
    expect(() => new CoreRunner(config)).toThrow('Workers must be positive');
  });

  it('should handle negative duration', () => {
    const config = createTestConfig({ options: { durationSec: -1 } });
    expect(() => new CoreRunner(config)).toThrow('Duration must be positive');
  });

  it('should handle malformed JSON configuration', async () => {
    await expect(loadConfig('malformed.json')).rejects.toThrow('Invalid JSON');
  });
});
```

## Security Testing (Enhanced)

### Authentication & Authorization

```typescript
// tests/e2e/security/auth.test.ts
describe('Security Testing', () => {
  it('should handle Bearer token authentication', async () => {
    const config = createTestConfig({
      options: { headers: { Authorization: 'Bearer valid-token' } },
    });

    const runner = new CoreRunner(config);
    await runner.run();

    const results = runner.getResultAggregator().getSampledResults();
    expect(results.some((r) => r.status === 401)).toBe(false);
  });

  it('should handle invalid authentication gracefully', async () => {
    const config = createTestConfig({
      options: { headers: { Authorization: 'Bearer invalid-token' } },
    });

    const runner = new CoreRunner(config);
    await runner.run();

    const results = runner.getResultAggregator().getSampledResults();
    expect(results.some((r) => r.status === 401)).toBe(true);
  });
});
```

## Cross-Platform Testing (Enhanced)

### Platform Compatibility

```typescript
// tests/e2e/cross-platform.test.ts
describe('Cross-Platform Compatibility', () => {
  it('should work on Windows', async () => {
    // Test Windows-specific path handling
    const config = createTestConfig({
      configPath: 'C:\\path\\to\\config.json',
    });
    await expect(loadConfig(config.configPath)).resolves.toBeDefined();
  });

  it('should work with different Node.js versions', async () => {
    const nodeVersion = process.version;
    const config = createTestConfig();
    const runner = new CoreRunner(config);

    await expect(runner.run()).resolves.not.toThrow();
  });
});
```

## Performance Baselines (Enhanced)

### Defined Metrics

```typescript
// tests/performance/baselines.ts
export const PERFORMANCE_BASELINES = {
  startupTime: 500, // ms
  memoryUsage: 50, // MB
  requestThroughput: 1000, // requests/second
  testExecutionTime: 30000, // 30 seconds max
  gcPressure: 10, // MB increase max
};

describe('Performance Baselines', () => {
  it('should maintain startup time baseline', async () => {
    const start = Date.now();
    const runner = new CoreRunner(createTestConfig());
    const initTime = Date.now() - start;

    expect(initTime).toBeLessThan(PERFORMANCE_BASELINES.startupTime);
  });

  it('should maintain memory usage baseline', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const runner = new CoreRunner(
      createTestConfig({ options: { durationSec: 5 } }),
    );
    await runner.run();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

    expect(memoryIncrease).toBeLessThan(PERFORMANCE_BASELINES.memoryUsage);
  });
});
```

## Test Utilities (Enhanced)

### Test Fixtures

```typescript
// tests/utils/test-fixtures.ts
export const createTestConfig = (overrides = {}) => ({
  $schema: 'https://example.com/schema.json',
  requests: [{ url: 'http://localhost:5000/success', method: 'GET' }],
  options: {
    workers: 1,
    durationSec: 1,
    rps: 10,
    useUI: false,
    silent: true,
    earlyExitOnError: false,
    ...overrides,
  },
});

export const startTestServer = async (port = 5000) => {
  const { spawn } = await import('child_process');
  const server = spawn('node', ['server.ts'], {
    stdio: 'pipe',
    env: { ...process.env, PORT: port.toString() },
  });

  // Wait for server to be ready with health check
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Server timeout')),
      10000,
    );

    const checkServer = async () => {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          clearTimeout(timeout);
          resolve();
        }
      } catch {
        setTimeout(checkServer, 500);
      }
    };
    checkServer();
  });

  return server;
};

export const createSecurityTestConfig = () =>
  createTestConfig({
    options: {
      headers: {
        Authorization: 'Bearer test-token',
        'X-API-Key': 'test-api-key',
      },
    },
  });
```

### Mock Utilities

```typescript
// tests/utils/mock-server.ts
import { MockAgent, setGlobalDispatcher } from 'undici';

export const createMockServer = () => {
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  return mockAgent;
};

export const createSecurityMock = (mockAgent: MockAgent) => {
  const mockPool = mockAgent.get('http://localhost:5000');

  // Success endpoint
  mockPool
    .intercept({ path: '/success', method: 'GET' })
    .reply(200, { success: true });

  // Auth required endpoint
  mockPool
    .intercept({ path: '/protected', method: 'GET' })
    .reply(401, { error: 'Unauthorized' });

  // Auth endpoint with valid token
  mockPool
    .intercept({
      path: '/protected',
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    })
    .reply(200, { data: 'protected' });

  return mockPool;
};
```

## Performance Regression Tests (Enhanced)

```typescript
// tests/performance/regression.test.ts
import { describe, it, expect } from 'vitest';
import { CoreRunner } from '../../src/core/runner/core-runner';
import { PERFORMANCE_BASELINES } from './baselines';

describe('Performance Regression', () => {
  it('should maintain baseline performance', async () => {
    const config = {
      requests: [{ url: 'http://localhost:5000/success', method: 'GET' }],
      options: { workers: 1, durationSec: 1, rps: 100 },
    };

    const start = Date.now();
    const runner = new CoreRunner(config);
    await runner.run();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1500);
  });

  it('should detect memory leaks', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 5; i++) {
      const runner = new CoreRunner(
        createTestConfig({ options: { durationSec: 1 } }),
      );
      await runner.run();

      // Force garbage collection if available
      if (global.gc) global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

    expect(memoryIncrease).toBeLessThan(PERFORMANCE_BASELINES.gcPressure);
  });
});
```

## Implementation Timeline (Updated)

### Week 1: Foundation & CLI/UI Testing

- [ ] Create simplified unit test directory structure
- [ ] Add unit tests for core modules (CoreRunner, RateLimiter, ExecutionEngine)
- [ ] Implement CLI command tests (config, init, run commands)
- [ ] Add UI component tests (latency-chart, stats-table, response-chart)
- [ ] Enhance existing test utilities and fixtures
- [ ] Add configuration validation edge case tests
- [ ] Update vitest.config.ts with coverage and timeout settings

### Week 2: E2E Framework & Edge Cases

- [ ] Set up test server automation with proper lifecycle management
- [ ] Create comprehensive E2E test scenarios using server.ts
- [ ] Add performance regression tests with concrete baselines
- [ ] Implement edge case testing (network failures, config errors)
- [ ] Add security testing scenarios (auth, validation)
- [ ] Add CLI integration tests

### Week 3: Cross-Platform & Polish

- [ ] Implement cross-platform compatibility tests (Node.js 18/20/22)
- [ ] Organize existing integration tests in new structure
- [ ] Add CI/CD integration with test matrix
- [ ] Create comprehensive test documentation
- [ ] Establish performance baselines and monitoring
- [ ] Add type safety tests

## Migration Strategy (Updated)

1. **Preserve existing tests** - Don't break what's working
2. **Add new tests incrementally** - Start with high-value modules
3. **Use enhanced test utilities** - Build on existing patterns
4. **Maintain CI/CD** - Ensure all tests run in pipeline
5. **Document patterns** - Help team adopt new practices
6. **Security-first testing** - Include auth and validation tests
7. **Cross-platform validation** - Test matrix for Node.js 18/20/22 on Windows/macOS/Linux

## Success Metrics (Updated)

- **Unit test coverage**: Target 80%+ for new modules (measured via coverage reports)
- **Test execution time**: Keep under 30 seconds (current: ~15-20 seconds)
- **E2E reliability**: 100% pass rate on stable features
- **Performance**: No regression >5% in baseline metrics
- **Security**: 100% auth scenario coverage and input validation
- **Cross-platform**: 100% pass rate on Node.js 18/20/22 across Windows/macOS/Linux

## Risk Mitigation (Updated)

- **Backward compatibility**: Existing tests continue to work unchanged
- **Incremental adoption**: No big-bang migration
- **Performance monitoring**: Track test execution times and memory usage
- **Documentation**: Clear patterns and examples for new tests
- **Security validation**: Regular security test audits
- **Platform testing**: CI matrix for all supported platforms and Node.js versions

## Next Steps (Updated)

1. Update vitest.config.ts with enhanced settings
2. Create the simplified test directory structure
3. Start with unit tests for core modules (CoreRunner, RateLimiter)
4. Set up E2E testing with server.ts and proper lifecycle management
5. Enhance existing test utilities and fixtures
6. Add performance regression tests with concrete baselines
7. Implement security testing scenarios
8. Add cross-platform compatibility tests with Node.js version matrix
