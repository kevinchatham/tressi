> UNFINISHED

# Performance Tuning

Ensure the Tressi runner itself does not become the performance bottleneck during high-scale tests.

### Overview

This document will cover:

- **Worker Scaling**: How to calculate the optimal number of `threads` based on target RPS and available CPU cores.
- **Connection Pooling**: Deep dive into the `AgentManager` and how to tune connection limits for high-concurrency scenarios.
- **Resource Monitoring**: Interpreting the "System Resources" metrics to identify when the generator is saturated.

### Scaling Tressi

Tressi is designed for high performance, but like any tool, it requires proper configuration to reach its full potential. Learn how to balance worker threads and memory limits to generate stable, high-volume traffic.

### Next Steps

Review [Remote Configurations & Security](./05-remote-configs.md) to learn how to centralize and secure your test definitions.
