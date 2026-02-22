# Execution Lifecycle

This section covers the internal mechanics of the Tressi execution engine lifecycle.

## 1. Initialization

When a test starts, the **Worker Pool Manager** orchestrates the following:

- **Resource Allocation**: Spawns the configured number of worker cores.
- **Endpoint Distribution**: Assigns targets to workers using a round robin algorithm to ensure balanced load generation.
- **Shared Memory Setup**: Initializes `SharedArrayBuffer` instances for zero copy atomic communication between cores, allowing for high frequency metrics updates without the overhead of message passing.

## 2. Ramp Up Phase

If ramp up duration is not zero, Tressi enters a linear progression phase:

- **Token Replenishment**: The rate limiter starts at zero and steadily increases the token replenishment rate until it reaches the target.
- **Staggered Execution**: Requests within a pipeline batch are staggered to prevent "thundering herd" effects on the target infrastructure.

## 3. Constant Load (Steady State)

Once the ramp up is complete, the engine maintains the target:

- **Pipeline Architecture**: Each worker maintains a pipeline depth of 15 concurrent requests. This ensures that network latency on one request does not block the generation of the next.
- **Burst Handling**: The token bucket algorithm allows for bursts up to twice the target. This accommodates minor system stutters while maintaining the requested average rate over time.
- **Telemetry Aggregation**: A dedicated metrics aggregator polls the shared memory every 1000ms to update the UI or TUI with live metrics.

## 4. Early Exit Monitoring

Throughout the execution, the **Early Exit Coordinator** monitors error rates and status codes:

- **Threshold Evaluation**: If an endpoint exceeds its Error Rate Threshold. or returns a blacklisted status code, it is stopped individually while other endpoints continue.
- **Test Termination**: The entire test run terminates early only if all endpoints have been stopped or all worker threads have reached a terminal state.

## 5. Finalization & Export

Upon reaching the duration:

- **Graceful Shutdown**: Workers finish in flight requests before terminating.
- **Data Consolidation**: Final metrics, including HDR histograms and response samples, are consolidated into the final test summary.
- **Persistence**: Results are saved to the local database (Web UI) or exported to the filesystem (CLI).

### Next Steps

Review [Interpreting Results](./04-interpreting-results.md) to learn how to analyze your test metrics.
