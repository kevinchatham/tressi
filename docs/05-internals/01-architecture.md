# Architecture Overview

Tressi is designed for high-performance load generation using a multi-process architecture.

## Components

### CLI (Commander)

The entry point for the application. It parses arguments, initializes the database, and either starts a test or the Hono server.

### Hono Server

Provides the REST API and serves the Angular-based Web UI. It uses Server-Sent Events (SSE) to broadcast real-time metrics during a test.

### Worker Threads

The engine of Tressi. Each worker thread is responsible for generating load for a subset of the configured endpoints.

### Shared Memory

Tressi uses `SharedArrayBuffer` to share metrics between worker threads and the main process without the overhead of message passing. This allows for real-time aggregation with zero impact on load generation performance.

### Execution Lifecycle Summary

```
sequenceDiagram
    participant M as Main Thread
    participant WPM as WorkerPoolManager
    participant WT as WorkerThreads
    participant SM as SharedArrayBuffer

    M->>WPM: Start Test
    WPM->>SM: Initialize Buffers
    WPM->>WT: Spawn Workers (Round-Robin)
    loop Execution
        WT->>WT: Rate Limit (Token Bucket)
        WT->>WT: Execute Pipeline (Depth 15)
        WT->>SM: Atomic Metrics Update
        WPM->>SM: Poll Metrics (1000ms)
        WPM->>M: Broadcast UI/TUI Updates
    end
    WT->>WPM: Signal Completion/Error
    WPM->>M: Consolidate & Export
```
