# Calculating Performance Metrics

Tressi uses shared memory and atomic operations to maintain performance metrics without synchronization bottlenecks.

### Tracking Latency Distribution

Tressi implements High Dynamic Range (HDR) Histograms to track latency across a wide range of values with constant relative accuracy.

- **Microsecond Resolution**: Recording latency in microseconds enables calculation of P99 and P99.9 percentiles.
- **Atomic Recording**: Worker threads use `Atomics.add` to increment histogram buckets in `SharedArrayBuffer`, ensuring $O(1)$ recording time.
- **Weighted Aggregation**: Calculating global statistics via weighted averages of histogram means and percentiles preserves accuracy across varying request volumes.
- **Logarithmic Visualization**: Merging histogram data into 10 logarithmic buckets provides resolution for the majority of requests while capturing the long tail.
- **Configurable Precision**: The implementation supports configurable significant figures (defaulting to 3), balancing memory footprint with data resolution.

### Analyzing Throughput

#### Calculating Peak RPS

Tressi calculates Peak Requests Per Second (RPS) using a sliding window to filter transient fluctuations and identify sustained performance limits.

- **Sliding Window**: A 5 second sliding window (or the total test duration if shorter) tracks RPS samples collected at 1 second intervals.
- **Median Calculation**: The peak RPS value is derived from the 50th percentile (median) of samples within the window, providing a stable representation of throughput.
- **Instantaneous Delta**: Each sample is calculated by measuring the delta in total requests between polling intervals.

#### Measuring Target Achievement

The **Target Achieved** metric quantifies the ratio of delivered throughput to requested load.

- **Endpoint Calculation**: Calculated as `Peak RPS / Configured RPS` for each endpoint.
- **Global Aggregation**: The global target achievement is the arithmetic mean of all endpoint achievement percentages.
- **Saturation Indicators**: Values below 100% indicate infrastructure saturation, network congestion, or load generator resource exhaustion.

#### Estimating Theoretical Capacity

Tressi estimates maximum throughput based on observed latency.

- **Theoretical Max RPS**: Calculated as `1000 / P50 Latency (ms)`. This represents the maximum throughput a single serial execution thread could achieve for a given endpoint.

### Monitoring Network Throughput

Tressi monitors network utilization by intercepting request and response streams.

- **Payload Tracking**: Aggregates the size of all outgoing request payloads and incoming response bodies.
- **Throughput Rate**: Calculated as `(Total Bytes Sent + Total Bytes Received) / Test Duration`, expressed in bytes per second.

### Tracking Status Codes

Atomic counters track the distribution of HTTP response codes to identify error patterns.

- **Full Range Tracking**: Dedicated counters for all status codes from 100 to 699.
- **Status Code Bitmap**: A 600 bit bitmap per endpoint ensures that only the first instance of a unique status code triggers a full response body sample, minimizing memory and I/O overhead.
- **Error Rate**: Calculated as `Failed Requests / Total Requests`, where failures are defined by the execution engine validation logic.

### Monitoring System Resources

System level metrics provide context for performance results and identify local bottlenecks.

- **CPU Utilization**: Calculated based on system load average relative to available CPU cores.
- **Memory Footprint**: Tracks the heap usage of the Tressi process throughout the test execution.
- **Sampling Interval**: Resource metrics are sampled every 2 seconds to minimize monitoring overhead.

### Next Steps

Learn how to contribute to the project or explore the licensing details in the [Community Section](../06-community/index.md).
