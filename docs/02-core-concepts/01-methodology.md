# Methodology

Tressi provides a high precision load testing framework designed to validate API performance against Service Level Objectives (SLOs). By utilizing parallel execution across dedicated worker threads, Tressi sustains targeted throughput to identify system behavior and resource contention under controlled pressure.

This document covers:

- **Target Achievement**: Measuring the percentage of requested throughput successfully delivered.
- **Throughput Control**: Understanding RPS based load generation and stability.

### Target Achievement

The **Target Achieved** metric measures the percentage of requested throughput successfully delivered. It identifies whether the target system or the testing environment reached saturation.

- **Global Achievement**: The aggregate percentage of total requested targets delivered across the entire configuration.
- **Endpoint Achievement**: The specific achievement rate for each target URL.
- **Contention Analysis**: Parallel testing identifies how endpoints compete for shared infrastructure resources, such as connection pools or internal bandwidth, which isolated tests may fail to trigger.

### Throughput Control

Tressi generates load based on targeted requests per second (RPS). Unlike tools that rely on virtual user counts, Tressi maintains a consistent arrival rate regardless of how slowly the target system responds.

- **Load Progression**: Use linear ramp up periods to warm up infrastructure before reaching peak intensity.
- **Throughput Stability**: Maintain a steady request volume to identify performance degradation, such as memory leaks or connection pool exhaustion, over the duration of the test.
- **Metric Accuracy**: By decoupling the request rate from system response times, Tressi ensures that latency metrics accurately reflect system performance under a specific, controlled load.

### Decoupled Execution

Tressi utilizes a decoupled architecture that separates the execution engine from the management interface. This enables consistent performance validation across different environments using a single configuration schema.

- **Headless Execution**: Run tests in automated pipelines or restricted environments using the CLI. The engine operates independently of the UI to ensure that resource consumption from the management interface does not impact load generation accuracy.
- **Environment Agnostic**: Execute the same JSON configurations on local workstations, internal load generators, or remote servers without modification.
- **Universal Data Export**: Generate performance reports in JSON, XLSX, or Markdown formats. This allows for the integration of test results into external analysis tools or shared documentation.

### Next Steps

Review the [Configuration Guide](./02-configuration.md) to learn how to define your load tests.
