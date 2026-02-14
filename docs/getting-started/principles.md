# Core Principles

Tressi is built on a set of core principles that guide its development and usage.

## Simplicity First

Load testing shouldn't require a PhD. Tressi aims to provide a simple, intuitive interface for both CLI and Web users.

## Accuracy Over Everything

We use high-performance primitives like `SharedArrayBuffer` and HDR Histograms to ensure that the metrics you see are as accurate as possible, even when generating massive amounts of load.

## Resource Efficiency

Tressi is designed to be lightweight. It uses worker threads to distribute load generation across all available CPU cores while maintaining a small memory footprint.

## Actionable Insights

We don't just show you numbers; we show you what they mean. Metrics like "Target Achieved" and "Sliding Window Peak" help you understand the real-world performance of your system.
