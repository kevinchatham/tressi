![Tressi Logo](./images/tressi-logo-512.png)

# Introduction

Tressi is a local load testing tool designed for API performance analysis. It provides a web-based interface for configuring tests, executing them in real-time, and analyzing the results with high precision.

## Core Capabilities

- **UI-Driven Workflow**: Manage configurations and view results through a modern web dashboard.
- **High-Performance Engine**: Utilizes Node.js worker threads and shared memory to generate significant load with minimal overhead.
- **Real-time Metrics**: Monitor P99 latency, RPS, and error rates as they happen.
- **Flexible Exporting**: Save test results in JSON, XLSX, or Markdown for reporting and further analysis.

## How it Works

Tressi runs locally on your machine. The backend handles the load generation and data aggregation, while the Angular-based UI provides a streamlined interface for interaction. By default, the UI is accessible at `http://localhost:3108`.
