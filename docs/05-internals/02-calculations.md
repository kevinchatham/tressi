# Calculations

Tressi uses several interesting calculations to provide accurate performance metrics.

## Sliding Window Peak RPS

To avoid noise and provide a realistic "peak" throughput, Tressi calculates RPS over a 5-second sliding window. This prevents momentary spikes from skewing the results while still capturing the sustained maximum capacity of your system.

## Target Achievement

The **Target Achieved** metric represents the percentage of requested RPS successfully delivered during the peak request window. It identifies whether the target system or the testing environment reached saturation.

- **100% Achievement**: The target infrastructure successfully processed the full requested load.
- **<100% Achievement**: Indicates a performance bottleneck. Failure to reach the target RPS typically results from target saturation, network constraints, or load generator resource exhaustion.

## Latency Percentiles

Tressi uses HDR (High Dynamic Range) Histograms to track latency. This allows for extremely accurate percentile calculations (P50, P95, P99) even under high load, with minimal memory overhead.
