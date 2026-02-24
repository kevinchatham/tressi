# Execution Engine

The Tressi execution engine utilizes an asynchronous pipeline architecture optimized for concurrent HTTP load generation.

### Managing Asynchronous Pipelines

Tressi workers maintain a concurrent pipeline to maximize network utilization without blocking on individual request response cycles.

- **Concurrent Execution**: Each worker maintains a `Set` of active Promises with a default pipeline depth of 15.
- **Event Loop Management**: The engine uses `setImmediate` to yield control between batches, preventing event loop starvation during high throughput scenarios.
- **Traffic Smoothing**: Apply a 2ms stagger between requests within a batch to prevent synchronized load effects on target infrastructure.
- **Batch Processing**: Workers retrieve batches of available requests from the rate limiter and execute them asynchronously, maintaining the pipeline depth as requests complete.

### Throughput Control

#### Endpoint Distribution

The engine distributes target endpoints across available worker threads using a round robin algorithm. This ensures that load generation is balanced across CPU cores and that no single worker is overwhelmed by a high volume of endpoints.

#### Rate Limiting

Throughput is controlled via a Token Bucket algorithm implemented in the `WorkerRateLimiter`.

- **Token Replenishment**: Tokens are generated based on the target RPS (Requests Per Second) and elapsed time.
- **Burst Capacity**: The bucket allows for bursts up to 2x the target RPS to handle transient network fluctuations while maintaining the long term target rate.
- **Linear Ramp Up**: The engine supports configurable ramp up periods, linearly increasing the token generation rate from zero to the target RPS.
- **Endpoint Specific Limiting**: Rate limits are calculated and enforced independently for each endpoint configuration.

### Request Execution

The `RequestExecutor` manages internal HTTP lifecycle using the `undici` client for optimized networking. The `AgentManager` coordinates connection pools per origin to optimize resource reuse.

- **Connection Pooling**: The `AgentManager` maintains endpoint specific agents with a default limit of 256 connections per origin, a 10,000ms keep-alive timeout, and 30,000ms timeouts for headers and bodies.
- **Object Pooling**: To minimize garbage collection overhead, the engine reuses header objects and result structures from a preallocated pool.
- **High Resolution Timing**: Latency is measured using `performance.now()` for microsecond precision.
- **Bandwidth Tracking**: The engine calculates `bytesSent` (request body) and `bytesReceived` (response body or `Content-Length` header) for network throughput metrics.
- **Response Sampling**: Response bodies are sampled based on status codes to provide debugging context without excessive memory consumption.

### Next Steps

Explore [Metrics and Calculations](./04-metrics-and-calculations.md) to understand how raw execution data is transformed into performance insights using HDR histograms and sliding window aggregation.
