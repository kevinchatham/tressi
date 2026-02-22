# Interpreting Results

Analyze test performance using global and per-endpoint metrics, visualizations, and system resource utilization data.

### Metric Scopes

Tressi provides two levels of granularity for performance data:

- **Global Metrics**: Aggregated data across all endpoints defined in the test configuration. Includes system resource utilization and total network throughput.
- **Endpoint Metrics**: Specific performance data for individual targets. Includes status code distributions and response samples.

### Throughput Metrics

Throughput measures the volume of requests processed by the target system.

- **Target Achieved**: The percentage of the configured target that was successfully executed. Values below 100% indicate the runner or target system could not maintain the requested load.
- **Peak RPS**: The highest throughput achieved within any 1-second measurement window.
- **Average RPS**: The mean number of requests per second completed throughout the test duration.
- **Max Throughput**: A theoretical maximum calculated based on median (P50) latency and a single concurrent request (1000 / P50).
- **Total Requests**: The absolute count of completed requests.

### Latency Metrics

Latency represents the round-trip time for requests, measured in milliseconds (ms). Tressi uses high-dynamic range (HDR) histograms to track percentiles accurately.

- **Min / Max**: The fastest and slowest individual response times recorded.
- **P50 (Median)**: 50% of requests were faster than this value. Represents the typical user experience.
- **P95**: 95% of requests were faster than this value. A standard benchmark for identifying performance degradation.
- **P99**: 99% of requests were faster than this value. Critical for identifying "tail latency" issues that affect the slowest 1% of requests.

### Reliability & Network

Monitor the stability and data transfer efficiency of the test execution.

- **Success Rate**: The ratio of successful (2xx) responses to total requests.
- **Error Rate**: The percentage of requests that resulted in non-2xx status codes or network-level failures.
- **Network Throughput**: The average rate of data transfer (bytes/sec) during the test.
- **Total Data**: The sum of all bytes sent in request bodies and received in response bodies.

### System Resources

Global metrics include the resource consumption of the Tressi runner process. Monitoring these ensures that the runner itself is not the bottleneck.

#### CPU Usage

Average system CPU utilization during the test.

- **Good**: < 70%
- **Warning**: 70% - 85%
- **Critical**: > 85%

#### Memory Usage

Average process memory consumption.

- **Good**: < 500 MB
- **Warning**: 500 MB - 1 GB
- **Critical**: > 1 GB

### Visualizations

#### Performance Over Time

A time series chart displaying fluctuations in throughput, latency, or error rates throughout the test duration. Use this to identify performance degradation over time.

#### Latency Distribution

The latency distribution visualization is divided into two primary views to help identify performance patterns and outliers.

- **Distribution**: Displays how requests are spread across latency buckets. This view highlights concentrations and groupings of response times. Tressi generates up to 10 logarithmic buckets between the minimum and maximum latencies recorded. Logarithmic scaling provides higher resolution for the majority of requests while still capturing the long tail of outliers. Empty buckets are omitted from the visualization.
- **Percentiles**: Illustrates time relativity and scale across the response spectrum. The width of each percentile bar is proportional to the maximum latency. For example, if the minimum latency is 100ms and the maximum is 1000ms, the 100ms bar will occupy 10% of the total width, providing a clear visual representation of the performance spread.

### Response Analysis

#### Status Code Distribution

A breakdown of all HTTP status codes returned by the target system. Essential for diagnosing the root cause of high error rates (e.g., 429 Too Many Requests vs. 500 Internal Server Error).

#### Response Samples

Tressi captures representative response data, including headers and bodies, to assist in debugging unexpected behavior or validation failures.

To optimize memory usage during high-concurrency tests, Tressi employs a "first seen" sampling strategy. The runner captures the first occurrence of each unique HTTP status code for every endpoint. Subsequent responses with the same status code for that endpoint are not stored. This ensures comprehensive coverage of different response types (e.g., 200 OK, 404 Not Found, 500 Internal Server Error) without the overhead of storing every response body.

### Next Steps

Review the [Advanced Concepts](../03-advanced/index.md) to explore advanced features and CI/CD integration.
