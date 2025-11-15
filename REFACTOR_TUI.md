# Tressi TUI Refactoring Plan for Multi-Worker Architecture

## Overview

This document outlines the comprehensive plan to refactor the Tressi terminal UI (TUI) to effectively utilize the multi-threaded/multi-worker architecture's aggregated metrics system.

## Current Architecture Analysis

### Existing Components

- **Worker Pool Management**: `WorkerPoolManager` coordinates multiple worker threads
- **Shared Memory**: `SharedMemoryManager` uses `SharedArrayBuffer` for lock-free worker communication
- **Metrics Aggregation**: `MetricsAggregator` collects real-time data from all workers
- **Minimal UI**: Already successfully uses `runner.aggregatedMetrics` for real-time updates

## Enhanced Data Transformation Layer

### Refactored Approach: Components Use AggregatedMetrics Directly

The refactoring eliminates external data transformation by having components accept `AggregatedMetrics` directly and handle formatting internally.

#### 1. StatsTable Internal Transformation

**Purpose**: Enhanced statistics table with worker context and system metrics using `AggregatedMetrics` directly

**Implementation**: `StatsTable.updateFromAggregatedMetrics(metrics, elapsedSec, totalSec)`

**Data Displayed**:

- Time progression with worker count
- System resource usage (CPU/memory)
- Request distribution per worker
- Success rate and error metrics
- Percentile breakdown (p95, p99)
- RPS calculations with worker efficiency

#### 2. ResponseChart Direct Status Code Usage

**Purpose**: Display individual HTTP status codes directly from `AggregatedMetrics.statusCodeDistribution`

**Implementation**: `ResponseChart.updateFromAggregatedMetrics(metrics, timeLabels, historicalData)`

**Key Features**:

- Direct usage of `metrics.statusCodeDistribution: Record<number, number>`
- Individual status code visibility (200, 201, 301, 404, 500, etc.)
- Color-coded display (green for 2xx, yellow for 3xx, red for 4xx/5xx)
- Toggle between global and per-endpoint views using `metrics.endpointMetrics`
- Top status codes highlighting with percentages

#### 3. LatencyChart Enhanced Percentile Bands

**Purpose**: Display multiple percentile bands using `AggregatedMetrics` percentile data directly

**Implementation**: `LatencyChart.updateFromAggregatedMetrics(metrics, timeLabels, historicalPercentiles)`

**Enhanced Features**:

- p50 (median), p95, p99, and average latency lines
- Direct usage of `metrics.p50Latency`, `metrics.p95Latency`, `metrics.p99Latency`, `metrics.averageLatency`
- Range indicators using `metrics.minLatency` and `metrics.maxLatency`
- Worker efficiency context using `metrics.threads`
- Multiple series display with color coding

## Component Enhancement Strategy

### 1. Enhanced Stats Table

**Current**: Basic time, RPS, success/fail, average latency
**Enhanced**:

- Worker count and efficiency metrics
- System resource usage (CPU/memory)
- Percentile breakdown (p95, p99)
- Requests per worker distribution

### 2. Enhanced Response Chart

**Current**: Category-based (2xx, 3xx, 4xx, 5xx)
**Enhanced**:

- Direct status code display (200, 201, 404, 500, etc.)
- Top status codes highlighting
- Toggle between global and per-endpoint views
- Color-coded problematic codes (4xx, 5xx)

### 3. Enhanced Latency Chart

**Current**: Simple average latency line
**Enhanced**:

- Percentile bands (p50, p95, p99)
- Worker efficiency context
- Latency range indicators
- Performance trend indicators

### 4. Enhanced Latency Distribution Table

**Current**: Basic distribution buckets
**Enhanced**:

- Worker-scaled distributions
- Endpoint-specific breakdowns
- Percentile markers

## Implementation Strategy

### Phase 1: Component Interface Refactoring

1. **StatsTable Enhancement**:
   - Add `updateFromAggregatedMetrics()` method
   - Implement internal formatting logic
   - Remove dependency on external DataTransformer

2. **ResponseChart Refactoring**:
   - Replace category-based approach with direct status codes
   - Add `updateFromAggregatedMetrics()` method
   - Implement color coding for status code ranges
   - Add toggle functionality for global vs per-endpoint views

3. **LatencyChart Enhancement**:
   - Add `updateFromAggregatedMetrics()` method
   - Implement multi-percentile line display
   - Add range indicators using min/max latency
   - Enhance with worker efficiency context

### Phase 2: Data Buffering and Historical Management

1. **Historical Data Management**:
   - Maintain CircularBuffer for time-series data
   - Store percentile historical data (p50, p95, p99, avg)
   - Buffer status code distribution over time
   - Implement data retention policies

2. **Enhanced Data Structures**:
   - Create buffered aggregated metrics storage
   - Implement efficient memory management for historical data
   - Add data compression for long-running tests

### Phase 3: TuiManager Integration

1. **Simplified Update Logic**:
   - Modify `update()` method to use `aggregatedMetrics` directly
   - Remove external DataTransformer dependencies
   - Implement direct component method calls

2. **View State Management**:
   - Add toggle mechanisms for different chart views
   - Implement endpoint selection for detailed views
   - Add configuration options for display preferences

## Key Code Changes

### Refactored TuiManager.update() - Direct AggregatedMetrics Usage

```typescript
public update(runner: Runner, elapsedSec: number, totalSec: number): void {
  const aggregatedMetrics = runner.aggregatedMetrics;

  if (aggregatedMetrics) {
    // Direct stats table update with aggregated metrics
    this.statsTable.updateFromAggregatedMetrics(aggregatedMetrics, elapsedSec, totalSec);

    // Direct response chart update with status codes
    this.responseChart.updateFromAggregatedMetrics(
      aggregatedMetrics,
      timeLabels,
      this.historicalStatusCodeData
    );

    // Direct latency chart update with percentile bands
    this.latencyChart.updateFromAggregatedMetrics(
      aggregatedMetrics,
      timeLabels,
      this.historicalPercentileData
    );

    // Direct endpoint metrics update
    this.latencyDistributionTable.updateFromAggregatedMetrics(
      aggregatedMetrics.endpointMetrics
    );
  }

  this.screen.render();
}
```

### Component Interface Changes

**StatsTable**:

```typescript
// Before: External transformation required
const statsData = DataTransformer.transformStatsData(transformedData);
this.statsTable.updateFromObject(statsData);

// After: Direct aggregated metrics usage
this.statsTable.updateFromAggregatedMetrics(
  aggregatedMetrics,
  elapsedSec,
  totalSec,
);
```

**ResponseChart**:

```typescript
// Before: Category-based with external transformation
const responseData =
  DataTransformer.transformAggregatedResponseData(aggregatedMetrics);
this.updateResponseChart(responseData, elapsedSec);

// After: Direct status codes from aggregated metrics
this.responseChart.updateFromAggregatedMetrics(
  aggregatedMetrics,
  timeLabels,
  historicalData,
);
```

**LatencyChart**:

```typescript
// Before: Single average latency line with external transformation
const latencyData =
  DataTransformer.transformAggregatedLatencyData(aggregatedMetrics);
this.updateLatencyChart(latencyData, elapsedSec);

// After: Multiple percentile bands from aggregated metrics
this.latencyChart.updateFromAggregatedMetrics(
  aggregatedMetrics,
  timeLabels,
  historicalPercentiles,
);
```

## Benefits

1. **Direct Data Usage**: Components use `AggregatedMetrics` directly without external transformation
2. **Consistency**: Both minimal and full UIs use identical `aggregatedMetrics` source
3. **Performance**: Eliminates external data transformation overhead
4. **Rich Context**: Comprehensive worker and system metrics with percentile bands
5. **Scalability**: Automatically adapts to different worker configurations
6. **Actionable Insights**: Direct status codes and endpoint breakdowns
7. **Clean Architecture**: Simplified data flow with internal component formatting
8. **Enhanced Visualization**: Multiple percentile bands and individual status codes
