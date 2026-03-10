# Optimizing Runner Performance

High concurrency tests can saturate the load generator, leading to inaccurate latency measurements and inconsistent request rates. Optimizing the Tressi runner ensures that performance bottlenecks originate from the target system rather than the testing infrastructure, which is especially critical when running in resource constrained pipelines.

This document covers:

- **Worker Scaling**: Distributing load across CPU cores to achieve high throughput.
- **Connection Management**: Optimizing resource reuse for high concurrency scenarios.
- **Resource Monitoring**: Identifying runner saturation to ensure test validity.

### Scale Workers

Tressi distributes load generation across CPU cores using a multithreaded architecture. Each worker thread manages a subset of endpoints and maintains an independent request pipeline. The `threads` option determines the number of worker threads; increasing this count allows Tressi to leverage more CPU cores, which is essential for high throughput tests.

When tuning for high throughput scenarios, reducing the number of endpoints assigned to each worker increases the achievable throughput per endpoint. Review the [Configuration Schema](../04-reference/02-schema.md) for thread limits and defaults.

> **Note**: A single Tressi worker thread can maintain approximately 8,000 requests per second in optimal conditions.

### Manage Worker Memory

The `workerMemoryLimit` option defines the maximum memory allocation for each worker thread.

- **Saturation Indicator**: Frequent garbage collection or workers reaching the memory limit.

If a worker exceeds its memory limit, it terminates and is marked as `ERROR`. Assigned endpoints will stop generating load, while the remaining test continues. This loss of target RPS can skew aggregate results.

To resolve memory issues, increase the memory limit or redistribute endpoints by increasing the thread count. Review the [Configuration Schema](../04-reference/02-schema.md) for memory constraints and defaults.

### Request Pipelining

Tressi workers use an internal asynchronous pipeline to maximize network utilization. This allows the runner to initiate multiple requests without waiting for previous responses, ensuring that network latency does not become a bottleneck for request generation.

### Connection Pools

Tressi manages connection pools automatically to optimize resource reuse. For details on the underlying networking implementation, see the [Execution Engine Internals](../05-internals/03-execution-engine.md).

### Next Steps

Centralize and secure test definitions by reviewing [Remote Configurations & Security](./05-remote-configs.md).
