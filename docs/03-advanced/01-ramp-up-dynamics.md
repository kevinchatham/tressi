> UNFINISHED

# Ramp Up Dynamics

Understand how linear load progression affects your performance metrics and telemetry.

### Overview

This document will cover:

- **Metric Interaction**: How the sliding peak request measurement window, average throughput, and target achieved metrics are calculated when ramp up is enabled.
- **Global vs. Per-Endpoint Ramp Up**: Understanding the hierarchy and execution logic when both global and individual ramp up durations are defined.
- **Telemetry Accuracy**: Why Tressi enforces a "Constant Load" window (at least 75% of test duration) to ensure reliable statistical analysis.

### Why use Ramp Up?

Sudden bursts of high-volume traffic can cause "thundering herd" effects that may not represent real-world usage patterns. Ramp up allows you to gracefully increase load, giving target systems time to scale resources, warm up caches, and stabilize connection pools before reaching peak intensity.

### Next Steps

Review [Early Exit Strategies](./02-early-exit.md) to learn how to protect your infrastructure during load tests.
