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
│    │                            │                             │   │
│    │   TOP-LEFT (0,0)           │        TOP-RIGHT (0,6)      │   │
│    │   [6 rows × 6 cols]        │        [6 rows × 6 cols]    │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    ├────────────────────────────┼─────────────────────────────┤   │
│    │                            │                             │   │
│    │  BOTTOM-LEFT (6,0)         │      BOTTOM-RIGHT (6,6)     │   │
│    │  [6 rows × 6 cols]         │      [6 rows × 6 cols]      │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    │                            │                             │   │
│    └────────────────────────────┴─────────────────────────────┘   │
│                                                                   │
│ [version]                                             [shortcuts] │
└───────────────────────────────────────────────────────────────────┘
```

## QUADRANT 1: TOP-LEFT (Primary Focus Area)

**Grid Position**: row 0, col 0, rowSpan 6, colSpan 6

### ASCII Template:

```
┌─────────────────────────────────────┐
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  Title: [Requests Per Second: ___]  │
└─────────────────────────────────────┘
```

### Toggle-Based Design for Quadrant 1

**Toggle Cycle:**

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

### Visual Feedback

**Title Field Usage:**
The `[___]` area in the ASCII template becomes dynamic:

- Updates immediately when toggling
- Shows current view mode clearly
- Includes brief instructions: "Press '1' to switch views"

**Status Indicator:**
Add a small indicator in the footer or corner showing:

- Cycle indicator: `[1/3]`

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
  - Mouse hover: Shows values for visible series only
  - Legend: Updates dynamically based on current view

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

### ASCII Template:

```
┌─────────────────────────────────────┐
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  Title: [_______________________]   │
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
   - Hover tooltips with exact values

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

### Gauge Specifications:

- **Layout**: Vertical stack (4 gauges, 1.5 rows each)
- **Size**: Optimized for 6×6 grid constraint
- **Color Thresholds** (configurable):
  - **p50**: Green <50ms, Yellow 50-100ms, Red >100ms
  - **p95**: Green <100ms, Yellow 100-200ms, Red >200ms
  - **p99**: Green <200ms, Yellow 200-500ms, Red >500ms
- **Display**: Percentage + absolute value (e.g., "65% - 120ms")
- **Update Frequency**: Every 500ms for responsive feel

---

## QUADRANT 3: BOTTOM-LEFT (System Metrics ↔ App Configuration)

**Grid Position**: row 6, col 0, rowSpan 6, colSpan 6

### Toggle-Based Design for Quadrant 3

**Toggle Cycle:**

1. **System Metrics View** (default)
2. **App Configuration View**

### ASCII Template:

```
┌─────────────────────────────────────┐
│                                     │
│  ┌──────┐     ┌──────┐    ┌──────┐  │
│  │ CPU  │     │ MEM  │    │ RPS  │  │
│  │ 75%  │     │ 45%  │    │ 95%  │  │
│  └──────┘     └──────┘    └──────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  [System Metrics Table]       │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### View Mode 1: System Metrics (Default)

**Component Specifications:**

- **Top Section (3 rows)**: Three `donut` components side by side
  - **Gauge 1**: CPU Usage
    - Label: "CPU"
    - Percent: 0-100%
    - Color: Green (<60%), Yellow (60-85%), Red (>85%)
  - **Gauge 2**: Memory Usage
    - Label: "MEM"
    - Percent: 0-100%
    - Color: Green (<60%), Yellow (60-80%), Red (>80%)
  - **Gauge 3**: RPS Achievement
    - Label: "RPS"
    - Percent: (actual/target) × 100
    - Color: Green (>90%), Yellow (70-90%), Red (<70%)

- **Bottom Section (3 rows)**: `table` component
  - **Columns**: Metric | Current | Target | Status
  - **Rows** (optimized for 6×6 constraint):
    - Workers Active
    - Success Rate
    - Avg Latency
    - Error Count
  - **Color Coding**: Green (good), Yellow (warning), Red (critical)

### View Mode 2: App Configuration

**Component Specifications:**

- **Full Section (6 rows)**: Single `table` component
- **Title**: "Test Configuration" (dynamic based on view mode)
- **Columns**: Setting | Value
- **Rows** (optimized for readability):
  - Test Endpoints (first 3, with count indicator)
  - Target RPS
  - Test Duration
  - Worker Threads
  - Test Status (Running/Paused/Completed)
  - Elapsed Time
  - Configuration File Path

**Data Display Format:**

- **Endpoints**: `https://api.example.com/users` (and 2 more...)
- **Target RPS**: `1000 req/s`
- **Duration**: `60s`
- **Workers**: `4 threads`
- **Status**: `🟢 Running` | `🟡 Paused` | `🔴 Completed`
- **Elapsed**: `00:02:15 / 01:00:00`

### Visual Feedback

**Title Field Usage:**

- System Metrics: "System Health & Performance"
- App Configuration: "Test Configuration & Settings"

**Status Indicator:**

- Add cycle indicator in corner: `[System/Config]`
- Updates immediately when toggling

### Toggle Logic

```typescript
// Pseudocode for toggle behavior
quadrant3View = 'system-metrics' // default

onKeyPress('3'):
  quadrant3View = (quadrant3View === 'system-metrics') ? 'app-config' : 'system-metrics'
  updateQuadrant3Title(quadrant3View)
  refreshQuadrant3Data()
```

### Implementation Notes

**Data Sources:**

- **System Metrics**: AggregatedMetrics from worker threads
- **App Configuration**: Runner.config and test state

**Update Frequency:**

- System Metrics: Every 1s (real-time)
- App Configuration: On toggle only (static data)

**Default Behavior:**

- Start in System Metrics view (most commonly needed during testing)
- Toggle preserves state when switching back and forth

---

## QUADRANT 4: BOTTOM-RIGHT (Status & Distribution)

**Grid Position**: row 6, col 6, rowSpan 6, colSpan 6

### ASCII Template:

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────────────┐                │
│  │                 │                │
│  │    DONUT CHART  │                │
│  │   Status Codes  │                │
│  │                 │                │
│  └─────────────────┘                │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Top Endpoints Table          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Component Specifications:

- **Top Section (3 rows)**: `donut` chart for status code distribution
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

- **Bottom Section (3 rows)**: `table` for top endpoints (optimized for 6×6 constraint)
  - **Label**: "Top Endpoints (RPS)"
  - **Columns**: Endpoint | RPS | Success%
  - **Data**: Top 5-6 endpoints by request count
  - **Sorting**: By RPS (descending)
  - **Format**: Shortened endpoint URLs (first 20 chars)
  - **Color**: Green/white text with color-coded success rates

### Toggle Modes:

1. **Status Distribution View** (default)
   - Shows status code donut + top endpoints table
   - Focus on current distribution and top performers

2. **Detailed Analysis View**
   - Shows extended status code breakdown
   - Includes response time distribution by status code
   - More detailed endpoint analysis

### Toggle Logic

```typescript
// Pseudocode for toggle behavior
quadrant4View = 'status-distribution' // default

onKeyPress('4'):
  quadrant4View = (quadrant4View === 'status-distribution') ? 'detailed-analysis' : 'status-distribution'
  updateQuadrant4Title(quadrant4View)
  refreshQuadrant4Data()
```

---

## KEYBOARD SHORTCUTS & CONTROLS

### Core Navigation:

- **Quit**: `q` / `esc` / `ctrl+c`
- **Global/Endpoint Toggle**: `tab` (cycles through global → endpoint1 → endpoint2 → ... → global)
- **Help Overlay**: `?` (shows all shortcuts and current view states)

### Quadrant Controls:

- **Quadrant 1 Toggle**: `1` (cycles through RPS view modes)
- **Quadrant 2 Toggle**: `2` (line chart ↔ gauge view)
- **Quadrant 3 Toggle**: `3` (system metrics ↔ app configuration)
- **Quadrant 4 Toggle**: `4` (status distribution ↔ detailed analysis)

### Removed Shortcuts:

- ~~`s` key~~ (replaced by `1`)
- ~~`g` key~~ (replaced by `2`)
- ~~`c` key~~ (replaced by `3`)
- ~~`t` key~~ (replaced by `tab`)
- ~~`e` key~~ (replaced by `tab`)
- ~~Arrow keys~~ (not needed with simplified navigation)
- ~~`f` key~~ (fullscreen mode removed)

### Status Bar Enhancement:

```
[Global View] [Q1: Actual/Target] [Q2: Line Chart] [Q3: System] [Q4: Status] | Press ? for help
```

Or when in endpoint mode:

```
[Endpoint: /api/users] [Q1: Actual/Target] [Q2: Line Chart] [Q3: System] [Q4: Status] | Press ? for help
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
