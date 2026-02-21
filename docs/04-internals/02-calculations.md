# Calculations

Tressi uses several interesting calculations to provide accurate performance metrics.

## Sliding Window Peak RPS

To avoid noise and provide a realistic "peak" throughput, Tressi calculates RPS over a 5-second sliding window. This prevents momentary spikes from skewing the results while still capturing the sustained maximum capacity of your system.

## Target Achieved

The "Target Achieved" metric represents the percentage of the requested RPS that Tressi was actually able to deliver. If you request 100 RPS but the system only delivers 80 RPS, the Target Achieved will be 80%. This is a critical indicator of whether your load generator or the target system is the bottleneck.

## Latency Percentiles

Tressi uses HDR (High Dynamic Range) Histograms to track latency. This allows for extremely accurate percentile calculations (P50, P95, P99) even under high load, with minimal memory overhead.
