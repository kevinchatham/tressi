# Tressi Terminal UI Layout - 4 Quadrant Template

Use this template to design and visualize the terminal UI layout. Each quadrant can contain different components based on the current view mode.

## Current Grid System

- **Grid Size**: 12 rows × 12 columns
- **Quadrant Size**: 6 rows × 6 columns each
- **Component Library**: blessed-contrib

## Quadrant Layout Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│    ┌────────────────────────────┬─────────────────────────────┐   │
│    │  QUADRANT 1: TOP-LEFT      │  QUADRANT 2: TOP-RIGHT      │   │
│    │  [RPS: Actual vs Target]   │  [Latency: Line Chart]      │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    │  ╱╲╱╲ Actual (White)       │  ╱╲    ╱╲    ╱╲ p99 (Red)   │   │
│    │ ╱╲─ Target (Yellow Dashed) │ ╱╲────╱╲────╱╲─ p95 (Yel)   │   │
│    │                            │╱╲╱╲╱╲╱╲╱╲╱╲╱╲ p50 (Cyan)    │   │
│    ├────────────────────────────┼─────────────────────────────┤   │
│    │  QUADRANT 3: BOTTOM-LEFT   │  QUADRANT 4: BOTTOM-RIGHT   │   │
│    │  [System: CPU/MEM/NET]     │  [Status: Distribution]     │   │
│    │  Press '3' to toggle view  │                             │   │
│    │                            │                             │   │
│    │  ┌──────┐ ┌──────┐ ┌──────┐│         ╱╲                  │   │
│    │  │ CPU  │ │ MEM  │ │ NET  ││    2xx ╱  ╲ 3xx             │   │
│    │  │ 75%  │ │ 45%  │ │ 95MB ││   75% ╱────╲ 10%            │   │
│    │  └──────┘ └──────┘ └──────┘│      ╱  ╱╲  ╲               │   │
│    │                            │     ╱  ╱__╲  ╲              │   │
│    └────────────────────────────┴─────────────────────────────┘   │
│                                                                   │
│ [Global] [1:RPS] [2:Latency] [3:System] [4:Status] | ?            │
└───────────────────────────────────────────────────────────────────┘
```

### View Mode Indicators:

- **Quadrant 1**: Shows current RPS view mode with cycle indicator [1/3]
- **Quadrant 2**: Shows line chart with 3 latency percentiles (p50/p95/p99)
- **Quadrant 3**: Shows system metrics donuts (CPU/Memory/Network)
- **Quadrant 4**: Shows status code distribution donut chart
- **Status Bar**: Shows current view states for all quadrants

## QUADRANT 1: TOP-LEFT (Primary Focus Area)

**Grid Position**: row 0, col 0, rowSpan 6, colSpan 6

### ASCII Templates:

#### View Mode 1: Actual vs Target RPS (Default)

```
┌─────────────────────────────────────┐
│  Requests Per Second: Actual vs     │
│  ┌───────────────────────────────┐  │
│  │  ╱╲╱╲╱╲ Actual RPS (White)    │  │
│  │ ╱╲╱╲╱╲╱╲ ── Target RPS (Yel)  │  │
│  │╱╲╱╲╱╲╱╲╱╲                     │  │
│  │                               │  │
│  │  50s   40s   30s   20s   10s  │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### View Mode 2: Success vs Error Breakdown

```
┌─────────────────────────────────────┐
│  Requests Per Second: Success vs    │
│  ┌───────────────────────────────┐  │
│  │  ╱╲╱╲╱╲ Success RPS (Green)   │  │
│  │ ╱╲╱╲╱╲╱╲ ── Error RPS (Red)   │  │
│  │╱╲╱╲╱╲╱╲╱╲                     │  │
│  │                               │  │
│  │  50s   40s   30s   20s   10s  │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### View Mode 3: Combined View (All Metrics)

```
┌─────────────────────────────────────┐
│  Requests Per Second: All Metrics   │
│  ┌───────────────────────────────┐  │
│  │  ╱╲ Actual (W) ╱╲ Success (G) │  │
│  │ ╱╲─Target (Y) ╱╲─Error (R)    │  │
│  │╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲     │  │
│  │                               │  │
│  │  50s   40s   30s   20s   10s  │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### View Modes:

1. **Actual vs Target RPS** (default view)
   - Title: "Requests Per Second: Actual vs Target"
   - Lines: Actual RPS (white), Target RPS (yellow dashed)
2. **Success vs Error Breakdown**
   - Title: "Requests Per Second: Success vs Errors"
   - Lines: Success RPS (green), Error RPS (red)
   - Note: Only shows when errors > 0, otherwise displays "No errors detected"
3. **Combined View** (optional toggle)
   - Title: "Requests Per Second: All Metrics"
   - Lines: All 4 series (for detailed analysis when needed)

**Visual Feedback:**

- Title field updates immediately when toggling
- Shows current view mode clearly
- Includes brief instructions: "Press '1' to switch views"
- Cycle indicator: `[1/3]` in footer or corner

**Toggle Logic:**

```typescript
// Pseudocode for toggle behavior
currentView = 0
views = ['actual-target', 'success-error', 'all-metrics']

onKeyPress('1'):
  currentView = (currentView + 1) % views.length
  updateChartTitle(views[currentView])
  refreshChartData()
```

### Component Specifications:

- **Component Type**: `line` chart (dynamic based on view mode)
- **Title**: Dynamic - updates to reflect current view
  - "Requests Per Second: Actual vs Target"
  - "Requests Per Second: Success vs Errors"
  - "Requests Per Second: All Metrics"
- **View Modes:**
  - **Mode 1** (default): Actual RPS + Target RPS
  - **Mode 2**: Success RPS + Error RPS (conditional display)
  - **Mode 3**: All metrics (for detailed analysis)
- **Y-Axis**: Dynamic scaling based on target RPS × 1.5
- **X-Axis**: Rolling Time labels (e.g., "5s", "10s", "15s") ( past minute )
- **Colors**:
  - White: Actual RPS
  - Yellow: Target RPS (dashed line)
  - Green: Success RPS
  - Red: Error RPS
- **Interactive Features**:
  - `1` key: Cycle through view modes
  - Legend: Updates dynamically based on current view

### Default View Highlights:

- **Primary Focus**: Shows actual performance vs target goals
- **Key Metrics**: Actual RPS (white line) compared against Target RPS (yellow dashed line)
- **Visual Cues**: Gap between lines indicates performance deviation
- **Use Case**: Ideal for monitoring if load test is meeting its target throughput

### Alternate View Highlights:

- **Success vs Error View**: Automatically switches when errors detected
- **Error Detection**: Red line shows error rate, green shows successful requests
- **Visual Impact**: Clear separation between healthy and failing requests
- **Combined View**: All metrics overlay for detailed performance analysis
- **Use Case**: Troubleshooting performance issues and error analysis

### Default Behavior:

- Start in "Actual vs Target" view (most commonly needed)

### Smart Toggle Logic:

```typescript
// Pseudocode for toggle behavior
currentView = 0
views = ['actual-target', 'success-error', 'all-metrics']

onKeyPress('1'):
  currentView = (currentView + 1) % views.length
  updateChartTitle(views[currentView])
  refreshChartData()
```

---

## QUADRANT 2: TOP-RIGHT (Secondary Focus Area)

**Grid Position**: row 0, col 6, rowSpan 6, colSpan 6

### ASCII Templates:

#### View Mode 1: Line Chart View (Default)

```
┌─────────────────────────────────────┐
│  Latency Percentiles Over Time      │
│  ┌───────────────────────────────┐  │
│  │  ╱╲    ╱╲    ╱╲ p99 (Red)     │  │
│  │ ╱╲────╱╲────╱╲─ p95 (Yel)     │  │
│  │╱╲╱╲╱╲╱╲╱╲╱╲╱╲ p50 (Cyan)      │  │
│  │                               │  │
│  │  50s   40s   30s   20s   10s  │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### View Mode 2: Gauge View (Toggle with `2` key)

```
┌─────────────────────────────────────┐
│  Current Latency Percentiles        │
│  ┌───────────────────────────────┐  │
│  │  p50: ████████░░ 65%  45ms    │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │  p95: ████████████ 85% 120ms  │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │  p99: ██████████████ 92% 250ms│  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │  [Green<50 Yel<200 Red>200]   │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### Component Specifications:

- **Component Type**: `line` chart (primary) with `gauge` toggle view
- **Title**: "Latency Percentiles" (dynamic based on view mode)
  - Line view: "Latency Percentiles Over Time"
  - Gauge view: "Current Latency Percentiles"
- **Data to Display**:
  - p50 latency (cyan line/gauge)
  - p95 latency (yellow line/gauge)
  - p99 latency (red line/gauge)
- **Y-Axis**: Dynamic scaling (minimum 100ms for line view)
- **X-Axis**: Time labels matching Quadrant 1 (line view only)
- **Legend**: Percentile indicators with color coding
- **Colors**:
  - Cyan: p50 (median)
  - Yellow: p95
  - Red: p99
- **Interactive Features**:
  - `2` key: Toggle between line chart and gauge view
  - Toggle individual percentile lines (line view)
  - Show/hide min/max range shading (line view)
  - Color-coded thresholds for gauges (configurable):
    - Green: Healthy thresholds
    - Yellow: Warning thresholds
    - Red: Critical thresholds
  - Endpoint-specific filtering

### View Modes:

1. **Line Chart View (Default)**
   - Shows historical trends over time
   - Best for identifying patterns and spikes
   - Multiple series with different colors

2. **Gauge View (Toggle with `2` key)**
   - Shows current/latest values only
   - Color-coded for instant status assessment
   - **Vertical stack layout** (optimized for 6×6 grid):
     ```
     ┌─────────────────────────────┐
     │  p50: 65%        45ms       │
     └─────────────────────────────┘
     ┌─────────────────────────────┐
     │  p95: 85%       120ms       │
     └─────────────────────────────┘
     ┌─────────────────────────────┐
     │  p99: 92%       250ms       │
     └─────────────────────────────┘
     ```
   - Current values displayed numerically within each gauge
   - Compact design fits 6×6 constraint
   - Color thresholds for instant assessment
   - **Gauge Specifications**:
     - Layout: Vertical stack (4 gauges, 1.5 rows each)
     - Size: Optimized for 6×6 grid constraint
     - Color thresholds (configurable):
       - p50: Green <50ms, Yellow 50-100ms, Red >100ms
       - p95: Green <100ms, Yellow 100-200ms, Red >200ms
       - p99: Green <200ms, Yellow 200-500ms, Red >500ms
     - Display: Percentage + absolute value (e.g., "65% - 120ms")
     - Update frequency: Every 500ms for responsive feel

---

## QUADRANT 3: BOTTOM-LEFT (System Metrics ↔ App Configuration)

**Grid Position**: row 6, col 0, rowSpan 6, colSpan 6

### ASCII Template:

```
┌─────────────────────────────────────┐
│                                     │
│  ┌──────┐     ┌──────┐    ┌──────┐  │
│  │ CPU  │     │ MEM  │    │ RPS  │  │
│  │ 75%  │     │ 45%  │    │ 95%  │  │
│  └──────┘     └──────┘    └──────┘  │
│                                     │
└─────────────────────────────────────┘
```

### View Modes:

1. **System Metrics View** (default)
   - Title: "System Health & Performance"
   - Three side-by-side `donut` components:
     - **CPU Usage**: Green (<60%), Yellow (60-85%), Red (>85%)
     - **Memory Usage**: Green (<60%), Yellow (60-80%), Red (>80%)
     - **Network Bandwidth**: Current throughput in MB/s, Green (<80MB/s), Yellow (80-150MB/s), Red (>150MB/s)
   - Update frequency: Every 1s (real-time)

2. **App Configuration View**
   - Title: "Test Configuration & Settings"
   - Single `table` component with Setting | Value columns
   - Rows include: Test Endpoints, Target RPS, Test Duration, Worker Threads, Test Status, Elapsed Time, Configuration File Path
   - Status indicators: 🟢 Running | 🟡 Paused | 🔴 Completed
   - Update frequency: On toggle only (static data)

**Toggle Logic:**

```typescript
// Pseudocode for toggle behavior
quadrant3View = 'system-metrics' // default

onKeyPress('3'):
  quadrant3View = (quadrant3View === 'system-metrics') ? 'app-config' : 'system-metrics'
  updateQuadrant3Title(quadrant3View)
  refreshQuadrant3Data()
```

**Visual Feedback:**

- Cycle indicator in corner: `[System/Config]`
- Updates immediately when toggling

### Component Specifications:

---

## QUADRANT 4: BOTTOM-RIGHT (Status & Distribution)

**Grid Position**: row 6, col 6, rowSpan 6, colSpan 6

### ASCII Templates:

#### View Mode 1: Status Distribution (Default)

```
┌─────────────────────────────────────┐
│  Status Code Distribution           │
│  ┌───────────────────────────────┐  │
│  │         ╱╲                    │  │
│  │    2xx ╱  ╲ 3xx               │  │
│  │   75% ╱────╲ 10%              │  │
│  │      ╱  ╱╲  ╲                 │  │
│  │     ╱╱____╲╲                  │  │
│  │    4xx    5xx                 │  │
│  │    12%    3%                  │  │
│  │                               │  │
│  │  Total: 15,234 requests       │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### View Mode 2: Detailed Analysis

```
┌─────────────────────────────────────┐
│  Detailed Status Code Analysis      │
│  ┌───────────────────────────────┐  │
│  │ Code │ Count │ Avg Latency    │  │
│  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │
│  │ 201  │ 3,125 │ 52ms           │  │
│  │ 404  │ 1,523 │ 23ms           │  │
│  │ 500  │  352  │ 125ms          │  │
│  │ 503  │  125  │ 89ms           │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### Component Specifications:

- **Default View**: `donut` chart for status code distribution
  - **Label**: "Status Code Distribution"
  - **Radius**: 8 characters
  - **Arc Width**: 3 characters
  - **Segments**:
    - 2xx (green): Successful requests
    - 3xx (yellow): Redirects
    - 4xx (red): Client errors
    - 5xx (magenta): Server errors
  - **Center Text**: Total requests count
  - **Legend**: Show percentages for each segment

- **Alternate View**: Extended analysis with detailed breakdown
  - Shows extended status code breakdown (all status codes)
  - Includes response time distribution by status code
  - More detailed endpoint analysis

### Default View Highlights (Status Distribution):

- **Primary Focus**: High-level HTTP status code categorization
- **Key Metrics**: 2xx/3xx/4xx/5xx request percentages in donut format
- **Visual Cues**: Color-coded segments (Green/Yellow/Red/Magenta) for instant health assessment
- **Use Case**: Quick overview of request success/failure ratios
- **Layout**: Compact donut chart with center total and percentage legend

### Alternate View Highlights (Detailed Analysis):

- **Primary Focus**: Granular status code breakdown and performance correlation
- **Key Metrics**: Individual status codes (200, 201, 404, 500, etc.) with response time analysis
- **Visual Cues**: Extended table or multi-series chart showing status-specific performance
- **Use Case**: Deep-dive analysis for troubleshooting specific error patterns
- **Additional Data**: Response time distribution per status code, endpoint-specific breakdowns

### Toggle Logic

```typescript
// Pseudocode for toggle behavior
quadrant4View = 'status-distribution' // default

onKeyPress('4'):
  quadrant4View = (quadrant4View === 'status-distribution') ? 'detailed-analysis' : 'status-distribution'
  updateQuadrant4Title(quadrant4View)
  refreshQuadrant4Data()
```

## KEYBOARD SHORTCUTS & CONTROLS

### Core Navigation:

- **Quit**: `q` / `esc` / `ctrl+c`
- **Global/Endpoint Toggle**: `tab` (cycles through global → endpoint1 → endpoint2 → ... → global)
- **Navigate Quadrants**: `arrow_keys` (small indicator should show which quadrant is `selected`)
- **Full Screen**: `f` (full screens the selected quadrant)
- **Help Overlay**: `?` (shows all shortcuts and current view states)

### Quadrant Controls:

- **Quadrant 1 Toggle**: `1` (cycles through RPS view modes)
- **Quadrant 2 Toggle**: `2` (line chart ↔ gauge view)
- **Quadrant 3 Toggle**: `3` (system metrics ↔ app configuration)
- **Quadrant 4 Toggle**: `4` (status distribution ↔ detailed analysis)

### Status Bar Enhancement:

```
[Global View] [1: Actual/Target] [2: Line Chart] [3: System] [4: Status] | Press ? for help
```

Or when in endpoint mode:

```
[Endpoint: /api/users] [1: Actual/Target] [2: Line Chart] [3: System] [4: Status] | Press ? for help
```

## COLOR SCHEME GUIDE

### Status Colors:

- **Green**: Success, healthy, within targets
- **Yellow**: Warning, approaching limits
- **Red**: Error, exceeded thresholds
- **Magenta**: Critical failures
- **Cyan**: Informational, neutral
- **White**: Primary data lines
- **Blue**: Secondary data, watermarks

### Chart Colors:

- **Latency**: Cyan (p50), Yellow (p95), Red (p99), White (avg)
- **RPS**: White (actual), Yellow (target), Green (success), Red (errors)
- **Status Codes**: Green (2xx), Yellow (3xx), Red (4xx), Magenta (5xx)
- **Resources**: Green (<70%), Yellow (70-85%), Red (>85%)

## DATA UPDATE FREQUENCY

Start with 500ms updates for all components, but ensure each can be changed individually as needed.

---

## NETWORK BANDWIDTH IMPLEMENTATION REQUIREMENTS

To implement the network bandwidth display in Quadrant 3, the following changes are required:

### 1. Shared Memory System Updates

- Add network bytes tracking to `src/workers/shared-memory-manager.ts`
- Track bytes sent/received per worker thread
- Add atomic counters for network throughput calculations

### 2. AggregatedMetrics Interface Updates

- Add network bandwidth fields to `src/workers/metrics-aggregator.ts`:
  - `networkBytesSent: number`
  - `networkBytesReceived: number`
  - `networkThroughputMBps: number`

### 3. MetricsAggregator Updates

- Modify `getResults()` method to calculate network bandwidth from shared memory data
- Calculate throughput based on bytes transferred over time window
- Aggregate network metrics across all worker threads

### 4. StatsTable Component Updates

- Replace RPS display with network bandwidth metrics in `src/ui/components/stats-table.ts`
- Update `updateFromAggregatedMetrics()` method to show:
  - Network throughput (MB/s)
  - Total data sent/received
  - Network efficiency metrics

### 5. Network Tracking Integration

- Integrate with HTTP request/response tracking in worker threads
- Track request/response body sizes
- Monitor connection overhead and protocol-specific metrics
- Update network counters in real-time during test execution

### Implementation Priority

This is a significant architectural change that requires modifications to the core metrics collection system. The network bandwidth tracking should be implemented as a new feature that integrates seamlessly with the existing worker thread architecture.

## MIGRATION STRATEGY: From Current to New TUI Architecture

### Current Component Mapping

This section maps existing TUI components to the new quadrant-based architecture:

#### **Current → New Quadrant Mapping**

| Current Component          | Current Location       | New Quadrant   | Migration Notes                                |
| -------------------------- | ---------------------- | -------------- | ---------------------------------------------- |
| `LatencyChart`             | Top-right (0,6,6,6)    | **Quadrant 2** | Direct migration with enhanced view modes      |
| `ResponseChart`            | Top-right (0,6,6,6)    | **Quadrant 4** | Convert from line chart to donut + table views |
| `StatsTable`               | Bottom-left (6,0,6,6)  | **Quadrant 3** | Split system metrics from test configuration   |
| `LatencyDistributionTable` | Bottom-right (6,6,6,6) | **Quadrant 4** | Enhanced detailed analysis view                |

#### **Detailed Migration Steps**

**Phase 1: Component Refactoring**

```typescript
// Current: src/ui/components/latency-chart.ts
export class LatencyChart {
  /* existing implementation */
}

// New: src/ui/components/quadrant-2-latency.ts
export class Quadrant2Latency {
  private lineChart: contrib.Widgets.LineElement;
  private gaugeView: contrib.Widgets.GaugeElement;
  private currentView: 'line' | 'gauge' = 'line';

  // Enhanced with toggle functionality
  toggleView(): void {
    /* implementation */
  }
}
```

**Phase 2: Data Flow Updates**

```typescript
// Current TuiManager.update() method needs modification:
public update(runner: Runner, elapsedSec: number, totalSec: number, targetReqPerSec?: number): void {
  const aggregatedMetrics = runner.aggregatedMetrics;

  // NEW: Update all quadrants with shared data
  this.quadrant1RPS.updateFromAggregatedMetrics(aggregatedMetrics, elapsedSec, targetReqPerSec);
  this.quadrant2Latency.updateFromAggregatedMetrics(aggregatedMetrics, this.timeLabels);
  this.quadrant3System.updateFromAggregatedMetrics(aggregatedMetrics);
  this.quadrant4Status.updateFromAggregatedMetrics(aggregatedMetrics, this.timeLabels);
}
```

**Phase 3: State Management**

- Migrate from individual component state to centralized quadrant state
- Implement shared `CircularBuffer` management across quadrants
- Add quadrant-specific keyboard event handling

---

## DATA INTERFACES & TYPE DEFINITIONS

### Core Data Interfaces

```typescript
// src/ui/types/quadrant-data.ts

export interface QuadrantData {
  timestamp: number;
  elapsedSec: number;
  aggregatedMetrics: AggregatedMetrics;
}

export interface Quadrant1RPSData extends QuadrantData {
  targetRPS?: number;
  actualRPS: number;
  successRPS: number;
  errorRPS: number;
  viewMode: 'actual-target' | 'success-error' | 'all-metrics';
}

export interface Quadrant2LatencyData extends QuadrantData {
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  viewMode: 'line-chart' | 'gauge';
  timeLabels: string[];
}

export interface Quadrant3SystemData extends QuadrantData {
  systemMetrics: {
    cpuUsage: number;
    memoryUsageMB: number;
    networkThroughputMBps: number;
  };
  configData?: {
    endpoints: string[];
    targetRPS: number;
    duration: number;
    workers: number;
    status: 'running' | 'paused' | 'completed';
  };
  viewMode: 'system-metrics' | 'app-config';
}

export interface Quadrant4StatusData extends QuadrantData {
  statusDistribution: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  detailedStatusCodes?: Array<{
    code: number;
    count: number;
    avgLatency: number;
  }>;
  viewMode: 'status-distribution' | 'detailed-analysis';
  totalRequests: number;
}
```

### Component Update Methods

```typescript
// Standardized update interface for all quadrants
export interface QuadrantComponent {
  update(data: QuadrantData): void;
  clear(): void;
  getElement(): blessed.Widgets.BlessedElement;
  setViewMode(mode: string): void;
}

// Implementation example for Quadrant 1
export class Quadrant1RPS implements QuadrantComponent {
  update(data: Quadrant1RPSData): void {
    const { actualRPS, successRPS, errorRPS, targetRPS, viewMode } = data;

    switch (viewMode) {
      case 'actual-target':
        this.renderActualVsTarget(actualRPS, targetRPS);
        break;
      case 'success-error':
        this.renderSuccessVsError(successRPS, errorRPS);
        break;
      case 'all-metrics':
        this.renderAllMetrics(actualRPS, targetRPS, successRPS, errorRPS);
        break;
    }
  }
}
```

---

## ERROR STATE HANDLING & FALLBACK DISPLAYS

### Error State Mockups

#### **Quadrant 1: RPS Chart - No Data Available**

```
┌─────────────────────────────────────┐
│  Requests Per Second: No Data       │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  ⚠ No requests recorded yet   │  │
│  │  Test may be starting...      │  │
│  │                               │  │
│  │  [Waiting for data...]        │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### **Quadrant 2: Latency - Connection Error**

```
┌─────────────────────────────────────┐
│  Latency Percentiles: Error         │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  ⚠ Connection lost            │  │
│  │  Retrying in 5s...            │  │
│  │                               │  │
│  │  [Reconnecting...]            │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### **Quadrant 3: System Metrics - Metrics Unavailable**

```
┌─────────────────────────────────────┐
│  System Health: Metrics Unavailable │
│  ┌───────────────────────────────┐  │
│  │  CPU: --%      MEM: --MB      │  │
│  │  ┌──────┐     ┌──────┐        │  │
│  │  │  --  │     │  --  │        │  │
│  │  └──────┘     └──────┘        │  │
│  │                               │  │
│  │  System metrics unavailable   │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### **Quadrant 4: Status Distribution - No Requests**

```
┌─────────────────────────────────────┐
│  Status Code Distribution: No Data  │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  ⚠ No HTTP requests yet       │  │
│  │  Waiting for traffic...       │  │
│  │                               │  │
│  │  [No data to display]         │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### Error Handling Implementation

```typescript
export class QuadrantErrorHandler {
  static handleNoData(quadrant: QuadrantComponent, message: string): void {
    quadrant.getElement().setContent(`⚠ ${message}\n[Waiting for data...]`);
    quadrant
      .getElement()
      .setLabel(`${quadrant.getElement().getLabel()}: No Data`);
  }

  static handleConnectionError(
    quadrant: QuadrantComponent,
    retryInSeconds: number,
  ): void {
    quadrant
      .getElement()
      .setContent(
        `⚠ Connection lost\nRetrying in ${retryInSeconds}s...\n[Reconnecting...]`,
      );
    quadrant
      .getElement()
      .setLabel(`${quadrant.getElement().getLabel()}: Error`);
  }

  static handlePartialData(
    quadrant: QuadrantComponent,
    availableMetrics: string[],
  ): void {
    // Show available metrics with placeholders for missing ones
    const content =
      availableMetrics.length > 0
        ? `Partial data available:\n${availableMetrics.join('\n')}\n⚠ Some metrics missing`
        : '⚠ No metrics available';

    quadrant.getElement().setContent(content);
  }
}
```

---

## PERFORMANCE CONSIDERATIONS & OPTIMIZATION

### Buffer Management Strategy

```typescript
// src/ui/buffer-manager.ts
export class QuadrantBufferManager {
  private static readonly BUFFER_SIZES = {
    TIME_SERIES: 100, // 100 data points for historical charts
    GAUGE_CURRENT: 1, // Only current value for gauges
    TABLE_SUMMARY: 50, // 50 rows max for table views
    STATUS_CODES: 20, // Top 20 status codes max
  };

  private buffers: Map<string, CircularBuffer<any>> = new Map();

  constructor() {
    // Initialize buffers for each quadrant
    this.buffers.set(
      'quadrant1-time',
      new CircularBuffer<string>(this.BUFFER_SIZES.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant1-rps',
      new CircularBuffer<number>(this.BUFFER_SIZES.TIME_SERIES),
    );
    this.buffers.set(
      'quadrant2-latency',
      new CircularBuffer<number>(this.BUFFER_SIZES.TIME_SERIES),
    );
    // ... etc
  }

  // Batch updates to reduce render frequency
  batchUpdate(quadrantId: string, data: any[]): void {
    const buffer = this.buffers.get(quadrantId);
    if (buffer) {
      data.forEach((item) => buffer.add(item));
    }
  }

  // Throttled updates to prevent UI blocking
  throttledUpdate(
    quadrantId: string,
    data: any,
    throttleMs: number = 500,
  ): void {
    // Implementation using lodash.throttle or custom throttling
  }
}
```

### Update Frequency Optimization

| Component                | Update Frequency | Buffer Size  | Render Strategy         |
| ------------------------ | ---------------- | ------------ | ----------------------- |
| **Quadrant 1 (RPS)**     | 500ms            | 100 points   | Real-time line updates  |
| **Quadrant 2 (Latency)** | 500ms            | 100 points   | Smooth line transitions |
| **Quadrant 3 (System)**  | 1000ms           | Current only | Donut smooth animations |
| **Quadrant 4 (Status)**  | 1000ms           | 20 codes max | Batch status updates    |

### Memory Management

```typescript
// Prevent memory leaks with automatic cleanup
export class QuadrantMemoryManager {
  private cleanupInterval: NodeJS.Timeout;
  private readonly MAX_MEMORY_AGE = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Clean up old data every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  private cleanup(): void {
    // Remove data older than 5 minutes
    // Clear unused buffers
    // Reset circular buffers that are full
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    // Clear all buffers
    // Reset all component states
  }
}
```

### Performance Monitoring

```typescript
// Built-in performance metrics for the TUI itself
export interface TuiPerformanceMetrics {
  renderTimeMs: number;
  bufferUtilization: number;
  memoryUsageMB: number;
  updateFrequency: number;
  droppedFrames: number;
}

export class TuiPerformanceMonitor {
  trackRenderTime(quadrantId: string, renderFn: () => void): number {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    return end - start;
  }

  // Alert if render time > 16ms (60fps threshold)
  checkPerformance(metrics: TuiPerformanceMetrics): void {
    if (metrics.renderTimeMs > 16) {
      console.warn(
        `Quadrant render time exceeded 60fps threshold: ${metrics.renderTimeMs}ms`,
      );
    }
  }
}
```

### Network Optimization

- **Batch API calls**: Combine multiple metric requests into single calls
- **WebSocket compression**: Enable per-message deflate for real-time updates
- **Delta updates**: Only send changed metrics, not full datasets
- **Client-side caching**: Cache frequently accessed configuration data
- **Lazy loading**: Load endpoint-specific data only when needed

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Week 1)

- [ ] Create quadrant base classes with standardized interfaces
- [ ] Implement buffer management system
- [ ] Set up error handling framework
- [ ] Create performance monitoring utilities

### Phase 2: Component Migration (Week 2)

- [ ] Migrate LatencyChart → Quadrant2Latency
- [ ] Migrate ResponseChart → Quadrant4Status
- [ ] Migrate StatsTable → Quadrant3System
- [ ] Create Quadrant1RPS from scratch

### Phase 3: Integration (Week 3)

- [ ] Implement keyboard navigation system
- [ ] Add view mode toggling logic
- [ ] Integrate with existing TuiManager
- [ ] Add status bar enhancements
