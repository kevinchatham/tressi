# Optimize Performance

Prevent runner bottlenecks during high concurrency tests.

### Performance Tuning Overview

This document covers:

- **Scaling Workers**: Calculating the optimal number of `threads` based on endpoint distribution.
- **Connection Management**: Reviewing built-in connection limits for high concurrency scenarios.
- **Monitor System Resources**: Interpreting system metrics to identify generator saturation.

### Scale Workers

Tressi distributes load generation across CPU cores using a multithreaded architecture. Endpoints are assigned to worker threads using a round robin algorithm. Each worker thread manages its own subset of endpoints and maintains an independent request pipeline.

#### Allocate Threads

The `threads` option determines the number of worker threads. By default, Tressi uses 4 threads, capped by the number of logical CPU cores available.

- **Minimum**: `1`
- **Default**: `4`
- **Maximum**: `os.cpus().length`
- **Configuration**: `options.threads`

A single Tressi worker thread can maintain approximately 8,000 requests per second in optimal conditions.

When tuning for high throughput scenarios, reducing endpoints per worker increases achievable throughput per endpoint.

#### Leverage Pipeline Architecture

Each worker thread maintains an internal pipeline of 15 concurrent requests. This allows the worker to fire multiple requests without waiting for previous completions, maximizing throughput during high latency. This pipeline depth is designed for high throughput execution and is not configurable.

### Connection Management

Tressi utilizes `undici` for HTTP execution. The `AgentManager` coordinates connection pools per origin to optimize resource reuse.

#### Review Connection Pool Limits

The default connection pool is configured for general use and is not configurable:

- **Max Connections**: 256 per origin.
- **Keep Alive Timeout**: 10,000ms.
- **Headers/Body Timeout**: 30,000ms.

If the generator reaches the connection limit, requests will queue, causing artificial latency. Monitor for queuing effects in scenarios with high concurrency or many unique origins.

### Monitor System Resources

Monitor resource consumption to ensure test validity. If the generator is saturated, reported metrics may reflect runner limitations rather than target system performance.

#### Monitor CPU Usage

Tressi calculates CPU usage based on system load average.

- **Saturation Indicator**: CPU usage consistently above 80%.
- **Impact**: Inaccurate latency measurements and dropped request cycles.

#### Manage Worker Memory

Each worker has a configurable memory limit.

- **Minimum**: `16MB`
- **Default**: `128MB`
- **Maximum**: `512MB`
- **Configuration**: `options.workerMemoryLimit`
- **Saturation Indicator**: Frequent garbage collection or workers reaching the memory limit.

If a worker exceeds its memory limit, it exits and is marked as `ERROR`. Assigned endpoints will stop generating load, while the remaining test continues. Loss of target RPS may skew results.

To resolve memory issues, increase `workerMemoryLimit` or redistribute endpoints by increasing the `threads` count.

### Next Steps

Centralize and secure test definitions by reviewing [Remote Configurations & Security](./05-remote-configs.md).
