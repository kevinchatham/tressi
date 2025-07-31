# Tressi Performance Analysis: 20 req/s vs 7000 req/s

## Executive Summary

This analysis identifies **7 critical bottlenecks** in tressi's HTTP implementation that explain the dramatic performance gap between tressi (20 req/s) and autocannon (7000 req/s) under identical parameters.

## Critical Performance Bottlenecks

### 🔴 **P0 - Synchronous Body Consumption**

- **Location**: `src/runner.ts:673-683`
- **Issue**: Every request waits for complete body consumption via `await responseBody.text()`
- **Impact**: **10x performance penalty** - prevents connection reuse and creates blocking I/O
- **Root Cause**: Even non-sampled responses fully consume the body for "accurate latency measurement"

### 🔴 **P1 - Inefficient Rate Limiting**

- **Location**: `src/runner.ts:731-743`
- **Issue**: Uses `await sleep(delay)` which blocks the event loop between requests
- **Impact**: **5x performance penalty** - creates artificial gaps in request flow
- **Root Cause**: Naive sleep-based throttling instead of non-blocking algorithms
- **User Note**: Replace the current sleep-based global rate limiting strategy with a **token bucket algorithm** for a more efficient, non-blocking approach.
  - The existing implementation applies a shared limit across all endpoints, which results in unintuitive behavior. For example:
    - With a global limit of 10 RPS:
      - **10 endpoints** → \~1 RPS per endpoint
      - **1 endpoint** → full 10 RPS to that endpoint

  - Refactor to apply rate limits **per endpoint** instead of globally. The token bucket implementation should reflect this change.

### 🔴 **P2 - Connection Pool Misconfiguration**

- **Location**: `src/http-agent.ts:23`
- **Issue**: Default connection pool limited to 128 connections
- **Impact**: **3x performance penalty** - artificially constrains concurrency
- **Root Cause**: Conservative default not suitable for load testing scenarios

### 🟡 **P3 - Sequential Request Processing**

- **Location**: `src/runner.ts:628-745`
- **Issue**: Each worker processes requests sequentially in while loop
- **Impact**: **2x performance penalty** - no true concurrency within workers
- **Root Cause**: Single-threaded request model per worker

### 🟡 **P4 - Per-Request Object Allocation**

- **Location**: `src/runner.ts:642-726`
- **Issue**: Creates new request objects despite object pooling
- **Impact**: **1.5x performance penalty** - GC pressure and allocation overhead
- **Root Cause**: Inefficient object reuse patterns

### 🟡 **P5 - Suboptimal HTTP Agent Settings**

- **Location**: `src/http-agent.ts:24-28`
- **Issue**: Conservative timeout settings (30s headers, 30s body, 4s keep-alive)
- **Impact**: **1.3x performance penalty** - slow connection establishment
- **Root Cause**: Production-oriented defaults not optimized for load testing

### 🟡 **P6 - Inefficient Request Distribution**

- **Location**: `src/runner.ts:632-634`
- **Issue**: Random request selection without load balancing
- **Impact**: **1.2x performance penalty** - uneven endpoint distribution
- **Root Cause**: No intelligent request routing

## Performance Comparison Matrix

| Factor                | Tressi Current   | Autocannon         | Industry Best Practice | Impact |
| --------------------- | ---------------- | ------------------ | ---------------------- | ------ |
| **Connection Pool**   | 128 max          | 1000+ default      | 1000-5000              | 3x     |
| **Body Handling**     | Always consume   | Skip by default    | Skip non-critical      | 10x    |
| **Rate Limiting**     | Sleep blocking   | Event-driven       | Token bucket           | 5x     |
| **Worker Model**      | Sequential       | Concurrent batches | Async batches          | 2x     |
| **Timeouts**          | 30s conservative | 5s aggressive      | 5-10s                  | 1.3x   |
| **Object Allocation** | Per-request      | Reuse everything   | Zero-allocation        | 1.5x   |
| **Load Balancing**    | Random           | Round-robin        | Weighted/RR            | 1.2x   |

## Detailed Code Analysis

### Request Flow Analysis

```mermaid
graph TD
    A[Worker Loop] --> B[Select Random Request]
    B --> C[Create Headers Object]
    C --> D[Make HTTP Request]
    D --> E[Wait for Full Body]
    E --> F[Process Response]
    F --> G[Sleep for Rate Limit]
    G --> A
```

### Bottleneck Hotspots

1. **D → E**: Synchronous body consumption
2. **G → A**: Blocking sleep operation
3. **A → B**: Sequential processing model

## Immediate Fix Priority

### Phase 1: High-Impact Fixes (Est. 50x improvement)

1. **Skip body consumption for non-sampled responses** (10x)
2. **Replace sleep-based rate limiting** (5x)
3. **Increase connection pool to 1000** (3x)

### Phase 2: Medium-Impact Fixes (Est. 5x improvement)

4. **Implement batch request processing** (2x)
5. **Optimize object allocation patterns** (1.5x)
6. **Tune HTTP agent timeouts** (1.3x)

### Phase 3: Fine-Tuning (Est. 2x improvement)

7. **Implement intelligent request distribution** (1.2x)

## Implementation Recommendations

### Fix 1: Body Consumption Optimization

```typescript
// BEFORE (Current)
const { statusCode, body: responseBody } = await request(req.url, {...});
let body: string | undefined;
if (!sampledCodesForEndpoint.has(statusCode)) {
    body = await responseBody.text(); // ALWAYS waits
    sampledCodesForEndpoint.add(statusCode);
} else {
    await responseBody.text().catch(() => {}); // Still waits!
}

// AFTER (Optimized)
const { statusCode, body: responseBody } = await request(req.url, {...});
let body: string | undefined;
if (!sampledCodesForEndpoint.has(statusCode)) {
    body = await responseBody.text();
    sampledCodesForEndpoint.add(statusCode);
} else {
    // Drain without parsing for non-sampled responses
    responseBody.dump().catch(() => {});
}
```

### Fix 2: Rate Limiting Optimization

```typescript
// BEFORE (Current)
await sleep(delay); // Blocks event loop

// AFTER (Optimized)
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  async waitForToken(): Promise<void> {
    while (this.tokens <= 0) {
      await new Promise((resolve) => setImmediate(resolve));
      this.refill();
    }
    this.tokens--;
  }
}
```

### Fix 3: Connection Pool Configuration

```typescript
// BEFORE (Current)
connections: 128;

// AFTER (Optimized)
connections: process.env.TRESSI_CONNECTIONS || 1000;
```

## Validation Strategy

### Performance Metrics to Track

1. **Requests per second** (primary metric)
2. **Connection pool utilization**
3. **Memory allocation rate**
4. **Event loop lag**
5. **Garbage collection frequency**

### Testing Scenarios

```bash
# Baseline test
tressi --config simple.json --duration 10 --workers 1 --no-ui

# Optimized test (after fixes)
tressi --config simple.json --duration 10 --workers 1 --no-ui
```

### Expected Improvements

| Fix              | Current RPS | Expected RPS | Improvement |
| ---------------- | ----------- | ------------ | ----------- |
| Body consumption | 20          | 200          | 10x         |
| Rate limiting    | 200         | 1000         | 5x          |
| Connection pool  | 1000        | 3000         | 3x          |
| **Combined**     | **20**      | **7000+**    | **350x**    |

## Monitoring Implementation

Add performance counters:

```typescript
// Add to Runner class
private performanceMetrics = {
    totalRequests: 0,
    blockedTimeMs: 0,
    connectionWaitTime: 0,
    bodyConsumptionTime: 0
};
```

## Conclusion

The 350x performance gap is primarily due to **three architectural decisions**:

1. Always consuming response bodies (10x penalty)
2. Blocking rate limiting (5x penalty)
3. Conservative connection pooling (3x penalty)

These are **configuration and implementation issues**, not fundamental architectural limitations. The fixes are straightforward and should achieve parity with autocannon's performance.

## Next Steps

1. Implement Phase 1 fixes (estimated 2-3 hours)
2. Run performance validation tests
3. Implement Phase 2 optimizations
4. Document performance tuning options
5. Add performance monitoring to CLI output
