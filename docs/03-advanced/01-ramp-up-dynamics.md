# Configuring Load Progression

Understand how linear load progression affects performance metrics and telemetry.

### Overview

This document covers:

- **Calculating Performance Metrics**: Calculation of sliding peak request measurement window, average throughput, and target achieved metrics.
- **Global vs. Per-Endpoint Ramp Up**: Hierarchy and execution logic for global and individual ramp up durations.
- **Ensuring Statistical Integrity**: Enforcement of the "Constant Load" window to ensure reliable statistical analysis.

### Load Stabilization

Sudden bursts of high-volume traffic can cause "thundering herd" effects that may not represent real-world usage patterns. Ramp up allows you to increase load, giving target systems time to scale resources, warm up caches, and stabilize connection pools before reaching peak intensity.

### Calculating Performance Metrics

Ramp up affects how Tressi calculates and reports performance data:

- **Average Throughput**: Calculated as total successful requests divided by the entire test duration. When ramp up is enabled, this value will be lower than the target RPS because it includes the low-intensity start period.
- **Peak Request Measurement**: Tressi uses a sliding window (maximum 5 seconds) to calculate the median RPS. This windowed approach filters out transient spikes and ramp up noise.
- **Target Achieved**: This percentage is derived from the peak (median windowed) RPS relative to the configured target RPS. It represents the system's ability to sustain the target load after the ramp up phase completes.
- **Metric Lag**: Because peak RPS is calculated over a sliding window (up to 5 seconds), real-time charts will exhibit a slight lag. The target RPS will not be reflected in the metrics until the sliding window has fully transitioned past the ramp up period.

### Global vs. Per-Endpoint Ramp Up

Tressi provides granular control over load progression:

- **Hierarchy**: Per-endpoint `rampUpDurationSec` takes precedence. If an endpoint defines a non-zero ramp up, it overrides the global setting for that specific request.
- **Default Behavior**: If an endpoint's ramp up is set to `0` (default), it inherits the global `rampUpDurationSec` defined in the test options.
- **Independent Scaling**: Each endpoint manages its own linear progression. This allows for complex scenarios where some services require longer warm up periods than others.
- **Minimum RPS Requirement**: When global ramp up is enabled, all endpoints must have a target RPS of at least 5 to ensure accurate linear interpolation.

### Ensuring Statistical Integrity

To maintain statistical integrity, Tressi enforces specific constraints on ramp up:

- **The 75% Rule**: Ramp up duration cannot exceed 25% of the total test duration. This ensures at least 75% of the test runs at the target intensity (the "Constant Load" window).
- **Statistical Significance**: By ensuring a majority of the test runs at peak load, Tressi provides reliable P99 latency and error rate metrics that aren't skewed by the initialization phase.

### Next Steps

Review [Automated Test Termination](./02-early-exit.md) to learn how to protect your infrastructure during load tests.
