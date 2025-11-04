# Worker Autoscaling and Event Loop Concurrency

This document explains how Tressi's worker system actually works, including autoscaling behavior and the reality of Node.js event loop concurrency.

## Understanding "Workers" in Tressi

### The Reality: Event Loop Concurrency

**Important**: Tressi's "workers" are **NOT** separate threads or processes. They all run within the **same Node.js process and event loop**. This is a common misconception.

- ❌ **NOT** multi-threaded
- ❌ **NOT** separate processes
- ✅ **Cooperative concurrency** via async/await
- ✅ **Better I/O interleaving** with more workers

## How Autoscaling Works

### Configuration Setting

The `workers` setting in your configuration is the **maximum** number of workers, not a fixed count.

### Autoscaling Algorithm

The system continuously monitors performance and adjusts worker count between 1 and your configured maximum:

#### 1. Monitoring Loop

- **Frequency**: Every 2 seconds during test execution
- **Location**: [`ExecutionEngine.performAutoscaling()`](src/core/runner/execution-engine.ts:154)

#### 2. Scaling Thresholds

- **Scale up**: When current RPS < 95% of target
- **Scale down**: When current RPS > 105% of target
- **Maintain**: When within 95%-105% range

#### 3. Adjustment Calculation

- **Scale factor**: 10% of needed adjustment
- **Minimum change**: Always adds/removes at least 1 worker
- **Maximum bound**: Never exceeds configured `workers` limit
- **Minimum bound**: Always maintains at least 1 worker

### Example Autoscaling Flow

For target RPS = 10,000 with `workers: 100` (maximum):

| Current RPS | Current Workers | Action     | New Worker Count | Reason                 |
| ----------- | --------------- | ---------- | ---------------- | ---------------------- |
| 9,400       | 5               | SCALE UP   | 10               | Below 9,500 threshold  |
| 10,600      | 15              | SCALE DOWN | 12               | Above 10,500 threshold |
| 9,800       | 10              | MAINTAIN   | 10               | Within range           |

## Event Loop Concurrency Explained

### Single-Threaded Reality

All workers share:

- **Single Node.js event loop**
- **Single CPU thread** for JavaScript execution
- **Shared memory space**

### Why More Workers Still Help

Despite being single-threaded, multiple workers provide benefits:

#### 1. **Better I/O Interleaving**

- **1 worker**: Sequential async operations create long promise chains
- **10 workers**: Concurrent async operations interleave more efficiently
- **100 workers**: Optimal async operation distribution

#### 2. **Connection Pool Utilization**

- **HTTP agent pooling**: More workers = better connection reuse
- **TCP connection limits**: Distributed across more concurrent requests
- **Network I/O efficiency**: Better pipelining of requests

#### 3. **Timer Precision**

- **1 worker at 10,000 RPS**: 0.1ms intervals (impossible with Node.js timers)
- **10 workers at 1,000 RPS**: 1ms intervals (achievable)
- **100 workers at 100 RPS**: 10ms intervals (optimal precision)

## Performance Implications

### High RPS Scenarios (10,000 RPS target)

| Workers | RPS per Worker | Timer Precision   | Connection Streams | Memory Usage | Achievable RPS |
| ------- | -------------- | ----------------- | ------------------ | ------------ | -------------- |
| 1       | 10,000         | ~1ms (too coarse) | 1                  | ~500MB       | ~3,000-5,000   |
| 10      | 1,000          | 1ms (acceptable)  | 10                 | ~50MB        | ~8,000-9,500   |
| 100     | 100            | 10ms (optimal)    | 100                | ~5MB         | ~9,800-10,000  |

### Key Insights

- **Timer precision** is the primary limiting factor for 1 worker
- **Connection utilization** improves with more workers
- **Memory pressure** decreases per worker with distribution
- **Realistic RPS achievement** requires appropriate worker count

## Best Practices

### Choosing Worker Count

1. **Start with**: `target RPS / 100` (gives 100 RPS per worker)
2. **Minimum**: Always use at least 2-5 workers for redundancy
3. **Maximum**: Set based on system memory (each worker ~5-10MB)

### Monitoring Autoscaling

Watch for these events during execution:

- `autoscaling`: Emitted when workers are added/removed
- `workerAdded`: New worker started
- `workerRemoved`: Worker stopped
- `rampUpProgress`: During RPS ramp-up phase

### Configuration Example

```json
{
  "options": {
    "rps": 10000,
    "workers": 100,
    "durationSec": 60
  }
}
```

This will:

- Start with 1 worker
- Autoscale between 1-100 workers
- Target 10,000 RPS
- Adjust every 1 second based on actual performance

## Common Misconceptions

1. **"Workers are threads"** ❌ - They're async functions, not OS threads
2. **"More workers = more CPU"** ❌ - Still single-threaded for CPU
3. **"Workers setting is fixed"** ❌ - It's the maximum, not fixed count
4. **"1 worker can handle any RPS"** ❌ - Limited by timer precision and I/O bottlenecks

## Summary

Tressi's worker system provides **cooperative concurrency** within Node.js's single-threaded event loop. The autoscaling feature intelligently adjusts worker count to maintain target RPS while respecting the configured maximum. Understanding this architecture helps optimize configurations for realistic load testing scenarios.
