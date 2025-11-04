# Rate Limiting Refactor Plan - REFACTOR_SLEEP.md

## Status: 🔴 ACTIVE - Requires Implementation

**Analysis Date**: 2025-11-03  
**Original Issue**: P1 - Naive Rate Limiting via `sleep`  
**Impact**: 5x performance penalty under concurrency

## Current State Assessment

### ✅ What's Been Done

- **TokenBucketRateLimiter class created** in `src/core/runner/rate-limiter.ts` (lines 161-257)
- **Basic RateLimiter class implemented** with window-based limiting
- **Architecture refactored** into modular components (execution-engine, worker-controller, etc.)

## Critical Issues Identified

### 1. Naive Sleep in WorkerController

**Location**: `src/workers/worker-controller.ts:147-156`

```typescript
private async applyRateLimiting(): Promise<void> {
  if (this.currentTargetRps > 0) {
    const batchDelay = 1000 / this.currentTargetRps;
    await this.sleep(batchDelay);  // ❌ Still using sleep!
  }
}
```

### 2. Basic RateLimiter in ExecutionEngine

**Location**: `src/core/runner/execution-engine.ts:242-247`

```typescript
if (this.currentTargetRps > 0) {
  await this.rateLimiter.waitForNextRequest(this.currentTargetRps); // ❌ Uses basic RateLimiter
}
```

### 3. Missing Per-Endpoint Rate Limiting

- All endpoints share the same global rate limit
- No endpoint-specific token buckets
- Cannot set different RPS targets per endpoint

## Proposed Solution Architecture

### Phase 1: Replace Sleep with Token Bucket

**Priority**: P1 - Critical

1. **Create EndpointRateLimiter class**
   - Individual token buckets per endpoint
   - Non-blocking token consumption
   - Configurable per-endpoint RPS limits

2. **Integrate into WorkerController**
   - Replace `applyRateLimiting()` with token bucket approach
   - Remove sleep-based delays

3. **Update ExecutionEngine**
   - Use TokenBucketRateLimiter instead of basic RateLimiter
   - Support per-endpoint configuration

### Phase 2: Per-Endpoint Configuration

**Priority**: P1 - Critical

1. **Extend RequestConfig schema**

   ```typescript
   interface TressiRequestConfig {
     url: string;
     method?: string;
     rps?: number; // Per-endpoint RPS limit. If this is not set the global value is used.
   }
   ```

2. **Create EndpointRateLimiterManager**
   - Manages multiple TokenBucketRateLimiter instances
   - One bucket per unique endpoint
   - Dynamic bucket creation based on config

### Phase 3: Non-Blocking Implementation

**Priority**: P2 - High

1. **Async token acquisition**
   - Replace `await sleep()` with `await bucket.waitForToken()`
   - Use micro-delays instead of full sleep cycles

2. **Worker coordination**
   - Distribute tokens across workers efficiently
   - Avoid global locks

## Implementation Plan

### Week 1: Core Infrastructure

- [ ] Create `EndpointRateLimiter` class
- [ ] Create `EndpointRateLimiterManager` class
- [ ] Add per-endpoint RPS configuration to schema
- [ ] Write unit tests for new rate limiting classes

### Week 2: Integration

- [ ] Replace `WorkerController.applyRateLimiting()` with token bucket
- [ ] Update `ExecutionEngine` to use new rate limiting
- [ ] Add configuration validation
- [ ] Update CLI to support per-endpoint RPS

### Week 3: Testing & Optimization

- [ ] Performance benchmarks comparing old vs new
- [ ] Load testing with various endpoint configurations
- [ ] Memory leak testing
- [ ] Documentation updates

## Code Structure

### New Files to Create

```
src/core/runner/
├── endpoint-rate-limiter.ts      # Per-endpoint rate limiting
├── endpoint-rate-limiter-manager.ts  # Manages multiple endpoints
└── rate-limit-config.ts          # Configuration interfaces

src/types/
└── rate-limit.types.ts          # Type definitions
```

### Modified Files

```
src/workers/worker-controller.ts   # Replace sleep-based limiting
src/core/runner/execution-engine.ts # Update rate limiter usage
src/core/validation/config-validator.ts # Add RPS validation
```

## Performance Targets

| Metric            | Current  | Target   | Improvement |
| ----------------- | -------- | -------- | ----------- |
| 10-worker RPS     | ~3,500   | ~17,500  | 5x          |
| 100-worker RPS    | ~30,000  | ~150,000 | 5x          |
| CPU Utilization   | ~20%     | ~80%     | 4x          |
| Memory Efficiency | Baseline | +20%     | Optimized   |

## Testing Strategy

### Unit Tests

- Token bucket algorithm correctness
- Per-endpoint isolation
- Thread safety for concurrent access
- Configuration validation

### Integration Tests

- Multi-endpoint rate limiting
- Worker coordination
- Dynamic configuration changes
- Performance regression testing

### Load Tests

- 10 endpoints @ 100 RPS each
- 100 endpoints @ 10 RPS each
- Mixed endpoint configurations
- Long-running stability tests

## Migration Path

### Backward Compatibility

- Default global RPS limit if no per-endpoint config
- Graceful fallback to current behavior
- Configuration warnings for deprecated patterns

### Migration Steps

1. **Phase 1**: Add new classes alongside existing ones
2. **Phase 2**: Gradually migrate worker controllers
3. **Phase 3**: Remove old RateLimiter classes
4. **Phase 4**: Update documentation and examples

## Risk Assessment

### Low Risk

- New classes don't affect existing functionality
- Gradual migration approach
- Comprehensive test coverage

### Medium Risk

- Configuration schema changes
- Performance regression if not properly tuned

### Mitigation

- Feature flags for gradual rollout
- Extensive benchmarking
- Rollback plan if issues arise

## Success Criteria

- [ ] 5x performance improvement under concurrent load
- [ ] Per-endpoint rate limiting working correctly
- [ ] No sleep-based delays in hot paths
- [ ] All existing tests pass
- [ ] New performance benchmarks established
- [ ] Documentation updated with examples

## Next Steps

1. **Immediate**: Create `EndpointRateLimiter` class
2. **This Week**: Implement basic token bucket integration
3. **Next Week**: Add per-endpoint configuration
4. **Following Week**: Performance testing and optimization

---

**Note**: This refactor is **critical** for achieving the 5x performance improvement mentioned in the original issue. The current implementation, while architecturally improved, still contains the fundamental performance bottleneck described in the P1 issue.
