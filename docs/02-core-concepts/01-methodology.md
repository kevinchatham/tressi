# Methodology

Tressi used a targeted load testing methodology designed to validate API performance against Service Level Objectives (SLOs). While stress testing identifies maximum capacity, Tressi validates the ability to sustain a predefined load.

### Target Achievement

The **Target Achieved** metric measures the percentage of requested Requests Per Second (RPS) successfully delivered during the peak request window. It identifies whether the target system or the testing environment reached saturation.

- **100% Achievement**: The target infrastructure successfully processed the full requested load.
- **<100% Achievement**: Indicates a performance bottleneck. Failure to reach the target RPS typically results from:
  - **Target Saturation**: Slow API response times or server side resource exhaustion.
  - **Network Constraints**: Latency or bandwidth limitations between the generator and target.
  - **Generator Bottlenecks**: Local system resource exhaustion (CPU, memory, or network I/O).

### Constant Load Execution

Tressi maintains a constant request rate throughout the test duration. This provides a stable environment for observing system behavior under sustained pressure, making it easier to identify memory leaks, connection pool exhaustion, or garbage collection issues that may not appear during short bursts or variable-rate tests.

### Local Performance Analysis

By running tests from a local environment or a controlled internal network, Tressi minimizes external network noise. This ensures that performance metrics reflect the actual capabilities of the application and its immediate infrastructure rather than internet-wide latency fluctuations.
