# Optimize Performance

Prevent runner bottlenecks during high concurrency tests.

### Performance Tuning Overview

This document covers:

- **Scaling Workers**: Calculating the optimal number of `threads` based on endpoint distribution.
- **Connection Management**: Reviewing built-in connection limits for high concurrency scenarios.
- **Monitor System Resources**: Interpreting system metrics to identify generator saturation.

### Scale Workers

Tressi distributes load generation across CPU cores using a multithreaded architecture. Each worker thread manages a subset of endpoints and maintains an independent request pipeline.

#### Allocate Threads

The `threads` option determines the number of worker threads. Increasing the thread count allows Tressi to leverage more CPU cores, which is essential for high throughput tests.

A single Tressi worker thread can maintain approximately 8,000 requests per second in optimal conditions.

When tuning for high throughput scenarios, reducing the number of endpoints assigned to each worker increases the achievable throughput per endpoint. Review the [Configuration Schema](../04-reference/02-schema.md) for thread limits and defaults.

#### Leverage Pipeline Architecture

Tressi workers use an internal asynchronous pipeline to maximize network utilization. This allows the runner to initiate multiple requests without waiting for previous responses, ensuring that network latency does not become a bottleneck for request generation.

### Connection Management

Tressi manages connection pools automatically to optimize resource reuse. For details on the underlying networking implementation, see the [Execution Engine Internals](../05-internals/03-execution-engine.md).

### Monitor System Resources

Monitor resource consumption to ensure test validity. If the generator is saturated, reported metrics may reflect runner limitations rather than target system performance.

#### Monitor CPU Usage

Tressi calculates CPU usage based on system load average.

- **Saturation Indicator**: CPU usage consistently above 80%.
- **Impact**: Inaccurate latency measurements and dropped request cycles.

#### Manage Worker Memory

The `workerMemoryLimit` option defines the maximum memory allocation for each worker thread.

- **Saturation Indicator**: Frequent garbage collection or workers reaching the memory limit.

If a worker exceeds its memory limit, it terminates and is marked as `ERROR`. Assigned endpoints will stop generating load, while the remaining test continues. This loss of target RPS can skew aggregate results.

To resolve memory issues, increase the memory limit or redistribute endpoints by increasing the thread count. Review the [Configuration Schema](../04-reference/02-schema.md) for memory constraints and defaults.

### Next Steps

Centralize and secure test definitions by reviewing [Remote Configurations & Security](./05-remote-configs.md).
