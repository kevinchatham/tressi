# Tressi Testing Strategy Refactor Plan - COMPREHENSIVE UPDATE

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

### **CRITICAL GAPS IDENTIFIED**

- **15+ source modules** without dedicated unit tests
- **Server.ts capabilities** underutilized in E2E planning
- **Missing test scenarios** for edge cases, security, performance
- **Migration strategy** lacks detail for directory structure changes

## Strategic Approach

### Phase 1: Preserve & Augment (Keep Existing Tests)

- **DO NOT replace** existing tests - they provide valuable integration coverage
- **Augment** with focused unit tests for new modular components
- **Maintain** backward compatibility during transition
- **Leverage** existing test utilities and patterns

### Phase 2: New Test Architecture (Comprehensive Structure)

```
tests/
├── unit/                    # Complete unit test coverage
│   ├── core/
│   │   ├── runner/
│   │   │   ├── core-runner.test.ts
│   │   │   ├── execution-engine.test.ts
│   │   │   └── rate-limiter.test.ts
│   │   └── validation/
│   │       └── config-validator.test.ts
│   ├── http/
│   │   └── agent-manager.test.ts
│   ├── request/
│   │   ├── request-executor.test.ts
│   │   ├── request-factory.test.ts
│   │   ├── response-processor.test.ts
│   │   ├── response-sampler.test.ts
│   │   └── error-handler.test.ts
│   ├── reporting/
│   │   ├── exporters/
│   │   │   ├── csv-exporter.test.ts
│   │   │   ├── xlsx-exporter.test.ts
│   │   │   └── data-exporter.test.ts
│   │   └── generators/
│   │       ├── html-generator.test.ts
│   │       ├── markdown-generator.test.ts
│   │       ├── json-generator.test.ts
│   │       └── stats-formatter.test.ts
│   ├── stats/
│   │   ├── aggregators/
│   │   │   └── result-aggregator.test.ts
│   │   ├── calculators/
│   │   │   ├── latency-calculator.test.ts
│   │   │   └── rps-calculator.test.ts
│   │   └── collectors/
│   │       ├── endpoint-collector.test.ts
│   │       ├── latency-collector.test.ts
│   │       └── status-code-collector.test.ts
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── config-command.test.ts
│   │   │   ├── init-command.test.ts
│   │   │   └── run-command.test.ts
│   │   └── display/
│   │       └── config-display.test.ts
│   ├── ui/
│   │   ├── components/
│   │   │   ├── latency-chart.test.ts
│   │   │   ├── stats-table.test.ts
│   │   │   ├── response-chart.test.ts
│   │   │   └── latency-distribution-table.test.ts
│   │   └── tui-manager.test.ts
│   ├── utils/
│   │   ├── circular-buffer.test.ts
│   │   ├── endpoint-cache.test.ts
│   │   ├── file-utils.test.ts
│   │   ├── object-pool.test.ts
│   │   ├── resource-manager.test.ts
│   │   ├── safe-directory.test.ts
│   │   └── validation-utils.test.ts
│   └── workers/
│       ├── worker-pool.test.ts
│       ├── worker-controller.test.ts
│       └── concurrency-calculator.test.ts
├── integration/             # Existing tests (preserved)
│   ├── config.test.ts
│   ├── exporter.test.ts
│   ├── summarizer.test.ts
│   ├── runner.test.ts
│   ├── early-exit.test.ts
│   ├── headers.test.ts
│   ├── optimization.test.ts
│   ├── utils.test.ts
│   ├── circular-buffer.test.ts
│   └── distribution.test.ts
├── e2e/                    # Comprehensive E2E tests using server.ts
│   ├── server.test.ts
│   ├── load-test.test.ts
│   ├── performance.test.ts
│   ├── security.test.ts
│   ├── cross-platform.test.ts
│   ├── edge-cases.test.ts
│   ├── server-capabilities.test.ts
│   ├── timeout-handling.test.ts
│   ├── redirect-following.test.ts
│   └── chunked-transfer.test.ts
├── fixtures/               # Test data and configurations
├── utils/                  # Test utilities and helpers (enhanced existing)
├── performance/            # Performance regression tests
│   ├── baselines.ts
│   ├── memory-leaks.test.ts
│   └── regression.test.ts
└── setup/                  # Test configuration and setup
```

## Detailed Implementation Plan

### **Phase 0: Foundation Setup (Week 0)**

- [ ] **Create migration script** for directory structure changes
- [ ] **Update vitest.config.ts** with enhanced settings
- [ ] **Set up test utilities** and fixtures
- [ ] **Document migration process** for team

### Phase 1: Unit Test Foundation & Missing Coverage (Week 1)

- [ ] **Create comprehensive unit test directory structure**
- [ ] **Add missing critical unit tests**:
  - [ ] `src/stats/aggregators/result-aggregator.test.ts`
  - [ ] `src/request/error-handler.test.ts`
  - [ ] `src/http/agent-manager.test.ts`
  - [ ] `src/utils/endpoint-cache.test.ts`
  - [ ] `src/utils/file-utils.test.ts`
  - [ ] `src/workers/concurrency-calculator.test.ts`
- [ ] **Implement CLI command tests** (config, init, run commands)
- [ ] **Add UI component tests** (latency-chart, stats-table, response-chart)
- [ ] **Add configuration validation edge case tests**
- [ ] **Enhance existing test utilities and fixtures**

### Phase 2: E2E Framework & Server Capabilities (Week 2)

- [ ] **Set up test server automation** with proper lifecycle management
- [ ] **Create comprehensive E2E test scenarios** using all server.ts endpoints:
  - [ ] `/health` - Health check validation
  - [ ] `/success`, `/server-error`, `/not-found` - Status code testing
  - [ ] `/delay/:ms` - Delayed response testing
  - [ ] `/timeout` - Timeout handling
  - [ ] `/chunked` - Chunked transfer encoding
  - [ ] `/redirect/:code` - Redirect following
  - [ ] `/rate-limit` - Rate limiting simulation
  - [ ] `/headers` - Header validation
- [ ] **Add performance regression tests** with concrete baselines
- [ ] **Implement edge case testing** (network failures, config errors)
- [ ] **Add security testing scenarios** (auth, validation)

### Phase 3: Cross-Platform & Performance (Week 3)

- [ ] **Implement cross-platform compatibility tests** (Node.js 18/20/22)
- [ ] **Add memory leak detection tests**
- [ ] **Organize existing integration tests** in new structure
- [ ] **Add CI/CD integration** with test matrix
- [ ] **Create comprehensive test documentation**
- [ ] **Establish performance baselines and monitoring**

## **NEW: Missing Module Unit Tests**

### HTTP Agent Manager Test

```typescript
// tests/unit/http/agent-manager.test.ts
import { describe, it, expect } from 'vitest';
import { AgentManager } from '../../../src/http/agent-manager';

describe('AgentManager', () => {
  it('should create agent with default options', () => {
    const agent = AgentManager.createAgent();
    expect(agent).toBeDefined();
  });

  it('should handle custom agent options', () => {
    const agent = AgentManager.createAgent({
      connections: 10,
      keepAliveTimeout: 5000,
    });
    expect(agent).toBeDefined();
  });
});
```

### Result Aggregator Test

```typescript
// tests/unit/stats/aggregators/result-aggregator.test.ts
import { describe, it, expect } from 'vitest';
import { ResultAggregator } from '../../../src/stats/aggregators/result-aggregator';

describe('ResultAggregator', () => {
  it('should aggregate results correctly', () => {
    const aggregator = new ResultAggregator();
    // Test aggregation logic
  });

  it('should handle empty results', () => {
    const aggregator = new ResultAggregator();
    expect(aggregator.getSampledResults()).toEqual([]);
  });
});
```

### Error Handler Test

```typescript
// tests/unit/request/error-handler.test.ts
import { describe, it, expect } from 'vitest';
import { ErrorHandler } from '../../../src/request/error-handler';

describe('ErrorHandler', () => {
  it('should classify network errors correctly', () => {
    const error = new Error('ECONNREFUSED');
    const classified = ErrorHandler.classifyError(error);
    expect(classified.category).toBe('NETWORK');
  });
});
```

## **NEW: Enhanced E2E Test Scenarios**

### Server Capabilities E2E Tests

```typescript
// tests/e2e/server-capabilities.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer } from '../utils/test-fixtures';

describe('Server Capabilities E2E', () => {
  let server: any;

  beforeAll(async () => {
    server = await startTestServer(5001);
  });

  afterAll(() => {
    server?.kill('SIGTERM');
  });

  it('should handle chunked transfer encoding', async () => {
    const config = createTestConfig({
      requests: [{ url: 'http://localhost:5001/chunked', method: 'GET' }],
    });
    // Test chunked response handling
  });

  it('should handle timeout scenarios gracefully', async () => {
    const config = createTestConfig({
      requests: [{ url: 'http://localhost:5001/timeout', method: 'GET' }],
      options: { timeoutMs: 2000 },
    });
    // Test timeout handling
  });

  it('should validate redirect following behavior', async () => {
    const config = createTestConfig({
      requests: [
        {
          url: 'http://localhost:5001/redirect/301?url=/success',
          method: 'GET',
        },
      ],
    });
    // Test redirect following
  });
});
```

### Memory Leak Detection Tests

```typescript
// tests/performance/memory-leaks.test.ts
import { describe, it, expect } from 'vitest';
import { CoreRunner } from '../../src/core/runner/core-runner';

describe('Memory Leak Detection', () => {
  it('should not leak memory during extended runs', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10; i++) {
      const runner = new CoreRunner(
        createTestConfig({
          options: { durationSec: 2, workers: 3, rps: 50 },
        }),
      );
      await runner.run();

      if (global.gc) global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

    expect(memoryIncrease).toBeLessThan(20); // Max 20MB increase
  });
});
```

## **NEW: Migration Strategy**

### Phase 0: Preparation

1. **Backup existing tests** - Ensure no data loss
2. **Create migration script** - Automated directory restructuring
3. **Update package.json** - Add test scripts for new structure
4. **Update CI/CD** - Handle new test paths

### Phase 1: Directory Restructuring

```bash
# Migration commands
mkdir -p tests/{unit,integration,e2e,performance,fixtures,utils,setup}
mv tests/*.test.ts tests/integration/
# Preserve existing functionality while adding new structure
```

### Phase 2: Incremental Population

1. **Week 1**: Add missing unit tests
2. **Week 2**: Add E2E tests with server.ts
3. **Week 3**: Add performance and security tests
4. **Week 4**: Complete migration and cleanup

## **UPDATED: Success Metrics**

- **Unit test coverage**: 100% of source modules with basic unit tests
- **Module coverage**: All 25+ source modules have dedicated tests
- **Server endpoint coverage**: All 15+ server.ts endpoints tested in E2E
- **Error scenario coverage**: 90%+ error paths validated
- **Performance**: No regression >5% in baseline metrics
- **Memory usage**: <20MB increase in leak detection tests
- **Cross-platform**: 100% pass rate on Node.js 18/20/22 across Windows/macOS/Linux
- **Test execution time**: Keep under 30 seconds (current: ~15-20 seconds)

## **UPDATED: Risk Mitigation**

- **Backward compatibility**: Existing tests continue to work unchanged
- **Incremental adoption**: No big-bang migration
- **Performance monitoring**: Track test execution times and memory usage
- **Documentation**: Clear patterns and examples for new tests
- **Security validation**: Regular security test audits
- **Platform testing**: CI matrix for all supported platforms and Node.js versions
- **Migration validation**: Automated verification of test structure changes

## **UPDATED: Next Steps**

1. **Immediate**: Create migration script and backup existing tests
2. **Week 1**: Add critical missing unit tests (result-aggregator, error-handler, agent-manager)
3. **Week 2**: Set up E2E testing with server.ts and proper lifecycle management
4. **Week 3**: Add performance regression tests with concrete baselines
5. **Week 4**: Implement security testing scenarios
6. **Week 5**: Add cross-platform compatibility tests with Node.js version matrix
7. **Week 6**: Complete migration and create comprehensive documentation

## **NEW: Priority Matrix**

| Priority     | Module              | Test Type   | Complexity |
| ------------ | ------------------- | ----------- | ---------- |
| **Critical** | result-aggregator   | Unit        | Medium     |
| **Critical** | error-handler       | Unit        | Low        |
| **Critical** | agent-manager       | Unit        | Medium     |
| **High**     | server-capabilities | E2E         | High       |
| **High**     | memory-leaks        | Performance | Medium     |
| **Medium**   | cross-platform      | E2E         | High       |
| **Medium**   | security            | E2E         | Medium     |
| **Low**      | UI components       | Unit        | Low        |
