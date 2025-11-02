# Tressi Project Restructuring Plan

## Executive Summary

This document outlines a comprehensive restructuring plan for the Tressi load testing tool to address code complexity, file size, and maintainability issues. The current codebase suffers from monolithic classes, high coupling, and violation of single responsibility principles.

## Current State Analysis

### File Size Issues

- **runner.ts**: 777 lines - Massive `Runner` class with 25+ methods ✓
- **summarizer.ts**: 317 lines - Complex report generation logic ✓
- **ui.ts**: 236 lines - UI logic mixed with data processing ✓
- **index.ts**: 365 lines - Multiple responsibilities in main entry point ✓
- **cli.ts**: 224 lines - CLI commands mixed with configuration handling ✓
- **exporter.ts**: 141 lines - Export functionality mixed with data processing ✓
- **config.ts**: 208 lines - Configuration validation and loading ✓
- **config-display.ts**: 148 lines - Configuration display logic ✓
- **stats.ts**: 39 lines - Status code distribution utilities ✓
- **distribution.ts**: 130 lines - Latency distribution calculations ✓
- **circular-buffer.ts**: 74 lines - Circular buffer utility
- **http-agent.ts**: 121 lines - HTTP agent management
- **utils.ts**: 137 lines - Utility functions
- **types.d.ts**: 164 lines - Type definitions

### Architecture Problems

1. **Single Responsibility Violations**: Classes handle multiple concerns
2. **High Coupling**: Direct dependencies between UI, runner, and statistics
3. **Large Methods**: Functions exceeding 50+ lines
4. **Mixed Abstraction Levels**: HTTP details mixed with orchestration
5. **Missing Components**: Existing files not accounted for in structure

## Target Architecture

### New Directory Structure (Corrected)

```
src/
├── core/
│   ├── runner/
│   │   ├── core-runner.ts          # Main orchestration (150-200 lines)
│   │   ├── execution-engine.ts     # Test execution logic (200-250 lines)
│   │   ├── rate-limiter.ts         # Rate limiting (100-150 lines)
│   │   └── agent-manager.ts        # HTTP agent management
│   ├── validation/
│   │   └── config-validator.ts     # Configuration validation
│   └── interfaces/
│       └── runner.interface.ts
├── request/
│   ├── request-executor.ts         # HTTP request execution
│   ├── request-factory.ts          # Request creation
│   └── response-processor.ts       # Response handling
├── workers/
│   ├── worker-pool.ts              # Worker management
│   ├── worker-controller.ts        # Individual worker control
│   └── concurrency-calculator.ts   # Dynamic scaling logic
├── stats/
│   ├── collectors/
│   │   ├── latency-collector.ts    # Latency data collection
│   │   ├── status-code-collector.ts # Status code aggregation
│   │   └── endpoint-collector.ts   # Per-endpoint metrics
│   ├── calculators/
│   │   ├── rps-calculator.ts       # Requests per second calculation
│   │   └── latency-calculator.ts   # Latency statistics
│   ├── aggregators/
│   │   └── result-aggregator.ts    # Result aggregation
│   ├── distribution.ts             # Distribution calculations (moved from root)
│   └── index.ts                    # Re-export stats utilities
├── reporting/
│   ├── generators/
│   │   ├── markdown-generator.ts   # Markdown report generation
│   │   ├── json-generator.ts       # JSON report generation
│   │   └── html-generator.ts       # HTML report generation
│   ├── exporters/
│   │   ├── csv-exporter.ts         # CSV export functionality
│   │   ├── xlsx-exporter.ts        # Excel export functionality
│   │   └── data-exporter.ts        # Combined export orchestration
│   └── formatters/
│       └── stats-formatter.ts      # Statistics formatting
├── cli/
│   ├── commands/
│   │   ├── init-command.ts         # Configuration initialization
│   │   ├── config-command.ts       # Configuration display
│   │   └── run-command.ts          # Main execution command
│   ├── validators/
│   │   └── config-validator.ts     # Configuration validation
│   └── display/
│       └── config-display.ts       # Configuration display logic (moved from root)
├── ui/
│   ├── components/
│   │   ├── latency-chart.ts        # Latency visualization
│   │   ├── response-chart.ts       # Response code chart
│   │   └── stats-table.ts          # Statistics table
│   └── tui-manager.ts              # Terminal UI management
├── utils/
│   ├── file-utils.ts               # File operations
│   ├── validation-utils.ts         # Validation helpers
│   ├── object-pool.ts              # Object pooling for performance
│   ├── endpoint-cache.ts           # Endpoint key caching
│   ├── resource-manager.ts         # Resource lifecycle management
│   ├── circular-buffer.ts          # Circular buffer utility (moved from root)
│   └── safe-directory.ts           # Directory name utilities (from utils.ts)
├── http/
│   └── agent-manager.ts            # HTTP agent management (from http-agent.ts)
└── shared/
    ├── types.d.ts                  # Shared type definitions
    └── constants.ts                # Application constants
```

## Phase-by-Phase Implementation

### Phase 1: Core Extraction (Week 1)

**Goal**: Extract statistics and request handling without breaking existing API

#### Week 1.1: Statistics Module

**Files to create:**

- `src/stats/collectors/latency-collector.ts`
- `src/stats/collectors/status-code-collector.ts`
- `src/stats/collectors/endpoint-collector.ts`
- `src/stats/calculators/rps-calculator.ts`
- `src/stats/calculators/latency-calculator.ts`
- `src/stats/aggregators/result-aggregator.ts`
- `src/stats/distribution.ts` (moved from existing)
- `src/stats/index.ts` (barrel exports)

**Extraction from runner.ts:**

- Lines 159-199: Entire `onResult` method → `ResultAggregator`
  - Lines 165-182: Status code and endpoint tracking
  - Lines 160-162, 198-199: Sampled results management
  - Lines 168-194: Endpoint tracking → `EndpointCollector`
- Lines 321-337: RPS calculation → `RpsCalculator`
- Lines 296-298: Average latency → `LatencyCalculator`
- Lines 165-182: Status code tracking → `StatusCodeCollector`
- Lines 551-558: Response sampling sets → `ResponseSampler`

**Additional extractions:**

- Move `src/distribution.ts` → `src/stats/distribution.ts`
- Move `src/stats.ts` → `src/stats/index.ts`

#### Week 1.2: Request Management

**Files to create:**

- `src/request/request-executor.ts`
- `src/request/request-factory.ts`
- `src/request/response-processor.ts`
- `src/request/error-handler.ts`

**Extraction from runner.ts:**

- Lines 607-678: HTTP request execution → `RequestExecutor`
- Lines 610-630: Request creation → `RequestFactory`
- Lines 632-646: Response processing → `ResponseProcessor`
  - Includes body sampling logic (lines 635-646)
- Lines 660-673: Error handling → `ErrorHandler`
- Lines 551-558: Response sampling logic → `ResponseSampler`

#### Week 1.3: Worker Management

**Files to create:**

- `src/workers/worker-pool.ts`
- `src/workers/worker-controller.ts`
- `src/workers/concurrency-calculator.ts`

**Extraction from runner.ts:**

- Lines 471-488: `addWorker()` method → `WorkerPool`
- Lines 480-488: `removeWorker()` method → `WorkerPool`
- Lines 712-776: `runWorker()` method (65 lines) → `WorkerController`
- Lines 684-704: Concurrency calculation → `ConcurrencyCalculator`
- Lines 387-430: Dynamic scaling logic → `ConcurrencyCalculator`

#### Week 1.4: Utility Extraction (Critical Missing Components)

**Files to create:**

- `src/utils/object-pool.ts`
  - Lines 490-533: Object pooling for headers and results
  - Lines 490-507: Headers object reuse
  - Lines 510-533: Result object pooling
- `src/utils/endpoint-cache.ts`
  - Lines 535-546: Endpoint key caching
- `src/utils/resource-manager.ts`
  - Lines 448-466: Resource lifecycle management
  - Lines 465: HTTP agent cleanup coordination
- `src/core/validation/config-validator.ts`
  - Lines 90-153: Configuration validation (63 lines)
- `src/utils/circular-buffer.ts`
  - Move from `src/circular-buffer.ts`
- `src/utils/safe-directory.ts`
  - Extract from `src/utils.ts`

### Phase 2: Runner Refactoring (Week 2)

**Goal**: Split monolithic Runner class into focused components

#### Week 2.1: Core Runner

**File: `src/core/runner/core-runner.ts`**

- Extract orchestration logic (150-200 lines)
- Maintain EventEmitter interface
- Delegate to specialized services
- Handle configuration validation (lines 90-153 from runner.ts)
- Coordinate event emission for UI updates

#### Week 2.2: Execution Engine

**File: `src/core/runner/execution-engine.ts`**

- Extract test execution loop (200-250 lines)
- Handle ramp-up and rate limiting
- Manage worker lifecycle
- Include early exit logic (lines 565-600 from runner.ts)
- Coordinate with WorkerPool and RateLimiter
- Handle resource cleanup coordination

#### Week 2.3: Rate Limiter

**File: `src/core/runner/rate-limiter.ts`**

- Extract rate limiting logic (100-150 lines)
- Handle dynamic scaling
- Provide rate control abstraction
- Include sleep utilities (lines 16-18 from runner.ts, also used at 767, 770, 773)

#### Week 2.4: Agent Manager

**File: `src/http/agent-manager.ts`**

- Extract HTTP agent management from runner.ts (lines 619-622) and http-agent.ts
- Handle per-endpoint agents
- Manage connection pooling
- Include globalAgentManager integration
- Provide clean agent lifecycle management

### Phase 3: UI & Reporting Separation (Week 3)

**Goal**: Separate UI from data processing and create modular reporting

#### Week 3.1: Report Generation

**Files to create:**

- `src/reporting/generators/markdown-generator.ts`
- `src/reporting/generators/json-generator.ts`
- `src/reporting/generators/html-generator.ts`
- `src/reporting/formatters/stats-formatter.ts`

**Extraction from summarizer.ts:**

- Lines 116-317: Markdown generation → `MarkdownGenerator`
- Lines 19-105: Summary generation → `SummaryGenerator`
- Extract statistics formatting → `StatsFormatter`

#### Week 3.2: Export Functionality

**Files to create:**

- `src/reporting/exporters/csv-exporter.ts`
- `src/reporting/exporters/xlsx-exporter.ts`
- `src/reporting/exporters/data-exporter.ts`

**Extraction from exporter.ts:**

- Lines 8-32: CSV export → `CsvExporter`
- Lines 34-105: Excel export → `XlsxExporter`
- Lines 116-141: Export orchestration → `DataExporter`

#### Week 3.3: UI Components

**Files to create:**

- `src/ui/components/latency-chart.ts`
- `src/ui/components/response-chart.ts`
- `src/ui/components/stats-table.ts`
- `src/ui/components/latency-distribution-table.ts`
- `src/ui/tui-manager.ts`
- `src/ui/data-transformer.ts`

**Extraction from ui.ts:**

- Lines 41-66: Chart components → Individual component files
- Lines 100-228: Update logic → TuiManager
- Lines 6: Data processing dependencies → `DataTransformer`
- Separate UI rendering from data processing
- Move data processing to stats modules

### Phase 4: CLI & Configuration Cleanup (Week 4)

**Goal**: Reduce CLI complexity and improve configuration handling

#### Week 4.1: CLI Commands

**Files to create:**

- `src/cli/commands/init-command.ts`
- `src/cli/commands/config-command.ts`
- `src/cli/commands/run-command.ts`

**Extraction from cli.ts:**

- Lines 31-82: Init command → `InitCommand`
- Lines 85-144: Config command → `ConfigCommand`
- Lines 191-222: Run command → `RunCommand`

**Additional extraction:**

- Move `src/config-display.ts` → `src/cli/display/config-display.ts`
- Extract configuration loading from cli.ts lines 95-144, 216-221

#### Week 4.2: Configuration Validation

**File: `src/cli/validators/config-validator.ts`**

- Extract validation logic from config.ts lines 90-146
- Create reusable validation service
- Handle schema validation and defaults
- Handle remote config fetching (lines 115-121)

#### Week 4.3: Utilities Extraction

**Files to create:**

- `src/utils/file-utils.ts` (from utils.ts file operations)
- `src/utils/validation-utils.ts` (from utils.ts validation helpers)
- `src/utils/circular-buffer.ts` (moved from root)
- `src/utils/safe-directory.ts` (directory name utilities from utils.ts)
- `src/utils/sleep.ts` (sleep utility from runner.ts lines 16-18)

### Phase 5: Final Cleanup (Week 5)

**Goal**: Complete migration and remove legacy code

#### Week 5.1: File Reorganization

**Files to move:**

- `src/circular-buffer.ts` → `src/utils/circular-buffer.ts`
- `src/distribution.ts` → `src/stats/distribution.ts`
- `src/stats.ts` → `src/stats/index.ts`
- `src/http-agent.ts` → `src/http/agent-manager.ts`
- `src/utils.ts` → split into `src/utils/file-utils.ts`, `src/utils/validation-utils.ts`, `src/utils/safe-directory.ts`

#### Week 5.2: Legacy Cleanup

- Update all imports to use new structure
- Finalize barrel exports
- Complete documentation
- Update package.json exports if needed

## Success Metrics

### File Size Targets

- Maximum file size: 300 lines
- Average method size: 25-50 lines
- Maximum method complexity: 10 cyclomatic complexity

### Architecture Goals

- **Single Responsibility**: Each class has one clear purpose
- **Low Coupling**: Modules depend on abstractions, not implementations
- **High Cohesion**: Related functionality grouped together

## Risk Mitigation (Enhanced)

### Critical Risk Areas

1. **Line Number Accuracy**: All extraction points verified against actual code ✓
2. **Missing Components**: Object pooling, configuration validation, resource management, and event handling now included ✓
3. **Performance Optimizations**: Object pooling and caching preserved ✓
4. **Cross-cutting Concerns**: Event handling, error propagation, and resource lifecycle addressed ✓
5. **File Size Accuracy**: Updated to reflect actual file sizes ✓

## Minor Considerations

### Type Dependencies

The `types.d.ts` file contains shared type definitions that will be imported across multiple modules during the refactoring process. Key dependencies include:

- `TestConfig` and related configuration interfaces used by validation modules
- `TestResult` and response data structures used by statistics collectors
- `EndpointStats` and metric types used by both UI and reporting modules
- HTTP-related types used by request execution and agent management modules

**Action Required**: Ensure `src/shared/types.d.ts` is properly referenced in all consuming modules and consider creating more granular type files if specific domains require extensive type definitions.

### Zod Schema Dependencies

Configuration validation uses Zod schemas defined in `config.ts` which creates potential circular dependency considerations:

- `config.ts` contains both schema definitions and validation logic
- New validation modules will need to import these schemas
- Configuration loading in CLI modules may create import cycles

**Mitigation Strategy**:

- Extract Zod schemas to `src/shared/schemas.ts` or `src/shared/config-schemas.ts`
- Create a dedicated schema validation layer separate from configuration loading
- Use barrel exports to manage schema imports cleanly

### Global Instances

The `globalAgentManager` from `http-agent.ts` is used throughout the codebase and requires careful handling during refactoring:

- Currently imported directly in multiple modules (runner.ts, summarizer.ts, exporter.ts)
- Manages shared HTTP agent instances across the application
- Must maintain singleton behavior during module extraction

**Handling Strategy**:

- Create a dedicated `src/http/agent-manager.ts` that wraps the global instance
- Implement dependency injection pattern for agent management
- Ensure the global instance lifecycle is properly managed during module initialization
- Consider using a service locator pattern for accessing the shared instance

## Implementation Checklist

### Phase 1: Core Extraction

- [ ] Extract statistics collectors
- [ ] Extract request management
- [ ] Extract worker management
- [ ] Extract object pooling utilities (lines 490-533, 551-558)
- [ ] Extract configuration validation (lines 90-153)
- [ ] Extract resource lifecycle management (lines 448-466)
- [ ] Extract response sampling logic (lines 551-558)
- [ ] Move existing files to new locations

### Phase 2: Runner Refactoring

- [ ] Create CoreRunner class
- [ ] Create ExecutionEngine class
- [ ] Create RateLimiter class
- [ ] Create AgentManager class
- [ ] Create EventCoordinator for module communication

### Phase 3: UI & Reporting

- [ ] Separate UI components
- [ ] Create report generators
- [ ] Create export modules
- [ ] Create data transformer for UI
- [ ] Create TUI manager abstraction

### Phase 4: CLI & Configuration

- [ ] Extract CLI commands
- [ ] Create configuration validator
- [ ] Extract utilities (file, validation, directory)
- [ ] Extract configuration loading logic
- [ ] Move config-display to CLI module

### Phase 5: Final Cleanup

- [ ] Complete file reorganization
- [ ] Remove deprecated code
- [ ] Update all imports
- [ ] Finalize barrel exports
- [ ] Performance validation
- [ ] API compatibility verification
- [ ] Update package.json exports
