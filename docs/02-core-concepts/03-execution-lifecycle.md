# Lifecycle Management

This section covers the internal mechanics of the Tressi execution engine lifecycle.

## 1. Initialize Test

When a test starts, Tressi prepares the execution environment:

- **Resource Allocation**: Spawns worker threads based on the test configuration.
- **Endpoint Distribution**: Distributes target URLs across available workers to ensure balanced load generation.
- **Environment Initialization**: Sets up the communication layer for realtime metrics aggregation.

## 2. Ramp Up

- **Load Progression**: The request rate increases linearly from zero to the target RPS over the configured duration.
- **Traffic Stabilization**: Requests are distributed to prevent sudden bursts, allowing target systems to scale and stabilize.

## 3. Steady State

- **Constant Load**: Tressi maintains the target request rate throughout the test duration.
- **Asynchronous Execution**: Workers generate requests in parallel to maximize throughput and minimize the impact of network latency.
- **Live Monitoring**: Performance data aggregates in realtime, providing immediate visibility into system behavior.

## 4. Monitor Early Exit

- **Threshold Evaluation**: If an endpoint exceeds its Error Rate Threshold. or returns a blacklisted status code, it is stopped individually while other endpoints continue.
- **Test Termination**: The entire test run terminates early only if all endpoints have been stopped or all worker threads have reached a terminal state.

## 5. Finalize & Export

- **Graceful Shutdown**: Workers finish in flight requests before terminating.
- **Data Consolidation**: Final metrics, including latency distribution data and response samples, are consolidated into the final test summary.
- **Persistence**: Results are saved to the local database (Web UI) or exported to the filesystem (CLI).

### Next Steps

Review [Interpreting Results](./04-interpreting-results.md) to learn how to analyze your test metrics.
