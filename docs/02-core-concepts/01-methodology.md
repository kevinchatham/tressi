# Methodology

Tressi uses a targeted load testing methodology designed to validate API performance against Service Level Objectives (SLOs). While stress testing identifies maximum capacity, Tressi validates the ability to sustain a predefined load.

### Measure Target Achievement

The **Target Achieved** metric measures the percentage of requested throughput successfully delivered. It identifies whether the target system or the testing environment reached saturation.

- **Global Achievement**: The aggregate percentage of total requested targets delivered across the entire configuration.
- **Endpoint Achievement**: The specific achievement rate for each target URL.
- **Contention Analysis**: Parallel testing identifies how endpoints compete for shared infrastructure resources, such as connection pools or internal bandwidth, which isolated tests may fail to trigger.

### Constant Load Execution

Tressi maintains a constant request rate throughout the test duration. This provides a stable environment for observing system behavior under sustained pressure, making it easier to identify memory leaks, connection pool exhaustion, or garbage collection issues that may not appear during short bursts or variable rate tests.

### Local Performance Analysis

By running tests from a local environment or a controlled internal network, Tressi minimizes external network noise. This ensures that performance metrics reflect the actual capabilities of the application and its immediate infrastructure rather than internet wide latency fluctuations.

### Next Steps

Review the [Configuration Guide](./02-configuration.md) to learn how to define your load tests.
