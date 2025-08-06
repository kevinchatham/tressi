# Per-Endpoint Autoscale Configuration Design

## Overview

This document outlines the architectural design for implementing per-endpoint autoscale configuration in Tressi, moving from global autoscale settings to granular per-endpoint control.

## Current System Analysis

- **Global Settings**: `autoscale`, `workers`, `rps`, `rampUpTime` apply to all endpoints
- **Single Target**: All endpoints share the same RPS target and scaling behavior
- **Limitation**: Cannot optimize for different endpoint characteristics (slow vs fast endpoints)

## New Configuration Schema

### Core Configuration Structure

```typescript
interface AutoscaleConfig {
  enabled: boolean;
  targetRps?: number;
  maxWorkers?: number;
  minWorkers?: number;
  rampUpTime?: number;
  scaleUpThreshold?: number; // % of target RPS to trigger scale-up
  scaleDownThreshold?: number; // % of target RPS to trigger scale-down
  scaleUpFactor?: number; // % of workers to add
  scaleDownFactor?: number; // % of workers to remove
  cooldownPeriod?: number; // seconds between scaling actions
}

interface EndpointAutoscaleConfig extends AutoscaleConfig {
  weight?: number; // relative weight for RPS distribution
  priority?: 'high' | 'medium' | 'low';
  endpointKey?: string; // auto-generated from method+url
}

interface GlobalAutoscaleDefaults extends AutoscaleConfig {
  defaultWeight?: number;
  distributionStrategy?: 'proportional' | 'equal' | 'priority-based';
}

interface PerEndpointConfig {
  autoscale?: EndpointAutoscaleConfig;
  // ... existing request config properties
}
```

### JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "AutoscaleConfig": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "targetRps": { "type": "integer", "minimum": 1 },
        "maxWorkers": { "type": "integer", "minimum": 1 },
        "minWorkers": { "type": "integer", "minimum": 1 },
        "rampUpTime": { "type": "integer", "minimum": 0 },
        "scaleUpThreshold": { "type": "number", "minimum": 0, "maximum": 1 },
        "scaleDownThreshold": { "type": "number", "minimum": 1 },
        "scaleUpFactor": { "type": "number", "minimum": 0.1, "maximum": 1 },
        "scaleDownFactor": { "type": "number", "minimum": 0.1, "maximum": 1 },
        "cooldownPeriod": { "type": "integer", "minimum": 1 }
      },
      "required": ["enabled"]
    },
    "EndpointAutoscaleConfig": {
      "allOf": [
        { "$ref": "#/definitions/AutoscaleConfig" },
        {
          "type": "object",
          "properties": {
            "weight": { "type": "number", "minimum": 0.1 },
            "priority": { "type": "string", "enum": ["high", "medium", "low"] },
            "endpointKey": { "type": "string" }
          }
        }
      ]
    }
  }
}
```

## Configuration Examples

### Example 1: Mixed Global and Per-Endpoint Settings

```json
{
  "$schema": "./schemas/tressi.schema.v0.0.14.json",
  "autoscale": {
    "enabled": true,
    "targetRps": 1000,
    "maxWorkers": 50,
    "minWorkers": 1,
    "rampUpTime": 15,
    "distributionStrategy": "proportional"
  },
  "requests": [
    {
      "url": "http://localhost:3000/api/health",
      "method": "GET",
      "autoscale": {
        "enabled": true,
        "targetRps": 100,
        "weight": 0.1,
        "priority": "high"
      }
    },
    {
      "url": "http://localhost:3000/api/users",
      "method": "GET",
      "autoscale": {
        "enabled": true,
        "targetRps": 400,
        "weight": 0.4,
        "priority": "medium"
      }
    },
    {
      "url": "http://localhost:3000/api/orders",
      "method": "POST",
      "autoscale": {
        "enabled": false
      }
    },
    {
      "url": "http://localhost:3000/api/products",
      "method": "GET"
    }
  ]
}
```

### Example 2: Advanced Per-Endpoint Configuration

```json
{
  "autoscale": {
    "enabled": true,
    "targetRps": 2000,
    "maxWorkers": 100,
    "distributionStrategy": "priority-based"
  },
  "requests": [
    {
      "url": "http://localhost:3000/api/critical-endpoint",
      "method": "POST",
      "autoscale": {
        "enabled": true,
        "targetRps": 500,
        "maxWorkers": 30,
        "minWorkers": 5,
        "scaleUpThreshold": 0.8,
        "scaleDownThreshold": 1.2,
        "scaleUpFactor": 0.3,
        "scaleDownFactor": 0.2,
        "cooldownPeriod": 5,
        "priority": "high",
        "weight": 0.25
      }
    }
  ]
}
```

## Inheritance Model

### Priority Rules (highest to lowest):

1. **Endpoint-specific autoscale settings** override all global settings
2. **Global autoscale defaults** apply to endpoints without specific settings
3. **Legacy global settings** (backward compatibility)

### Configuration Resolution Algorithm

```typescript
function resolveEndpointConfig(endpoint, globalDefaults) {
  if (endpoint.autoscale?.enabled === false) {
    return { enabled: false };
  }

  if (endpoint.autoscale?.enabled === true) {
    return { ...globalDefaults, ...endpoint.autoscale };
  }

  if (globalDefaults.enabled) {
    return { ...globalDefaults, enabled: true };
  }

  return { enabled: false };
}
```

## Implementation Strategy

### 1. Configuration Layer

- Extend existing `TressiConfigSchema` with new autoscale structure
- Maintain backward compatibility with legacy global settings
- Add validation for per-endpoint configurations

### 2. Runner Architecture Changes

#### New Classes

```typescript
class EndpointAutoscaleManager {
  private endpointConfigs: Map<string, EndpointAutoscaleConfig>;
  private globalDefaults: GlobalAutoscaleDefaults;
  private workerAllocations: Map<string, number>;
  private endpointMetrics: Map<string, EndpointMetrics>;

  constructor(config: TressiConfig) {
    this.resolveConfigurations(config);
  }

  calculateWorkerDistribution(): Map<string, number> {
    // Distribute workers based on weights, priorities, and current performance
  }

  shouldScaleEndpoint(endpointKey: string): ScalingDecision {
    // Determine if specific endpoint needs scaling
  }
}

class EndpointMetrics {
  currentRps: number;
  targetRps: number;
  avgLatency: number;
  errorRate: number;
  lastScaleTime: number;
}
```

#### Modified Runner Class

```typescript
class Runner extends EventEmitter {
  private autoscaleManager: EndpointAutoscaleManager;
  private endpointWorkers: Map<string, WorkerPool>;

  // Replace single autoscale interval with per-endpoint management
  private endpointScalingIntervals: Map<string, NodeJS.Timeout>;

  async run(): Promise<void> {
    if (this.hasPerEndpointAutoscale()) {
      await this.runPerEndpointAutoscale();
    } else {
      await this.runLegacyAutoscale();
    }
  }
}
```

### 3. Worker Distribution Strategies

#### Proportional Distribution

Workers allocated based on target RPS ratios:

```
endpointA: targetRps=100, weight=0.1 → 10% of workers
endpointB: targetRps=400, weight=0.4 → 40% of workers
endpointC: uses global → remaining 50% of workers
```

#### Priority-Based Distribution

1. High priority endpoints get minimum required workers
2. Medium priority gets remaining workers proportionally
3. Low priority gets workers only after high/medium satisfied

#### Equal Distribution

Workers divided equally among active endpoints

### 4. Scaling Decision Engine

#### Per-Endpoint Scaling Logic

```typescript
interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'maintain';
  workers: number;
  reason: string;
}

function makeScalingDecision(
  endpointKey: string,
  metrics: EndpointMetrics,
  config: EndpointAutoscaleConfig,
): ScalingDecision {
  const currentWorkers = getCurrentWorkers(endpointKey);
  const currentRps = metrics.currentRps;
  const targetRps = config.targetRps;

  if (currentRps < targetRps * config.scaleUpThreshold) {
    const neededWorkers = Math.ceil(
      currentWorkers * (targetRps / Math.max(currentRps, 1)),
    );
    const workersToAdd = Math.min(
      Math.ceil(neededWorkers * config.scaleUpFactor),
      config.maxWorkers - currentWorkers,
    );

    return {
      action: 'scale-up',
      workers: workersToAdd,
      reason: `RPS ${currentRps} < ${targetRps * config.scaleUpThreshold}`,
    };
  }

  // Similar logic for scale-down...
}
```

## Backward Compatibility Strategy

### Legacy Mode Detection

```typescript
function detectLegacyMode(config: TressiConfig): boolean {
  return (
    config.autoscale !== undefined &&
    typeof config.autoscale === 'boolean' &&
    !config.requests.some((r) => r.autoscale !== undefined)
  );
}
```

### Migration Path

1. **Phase 1**: Support both legacy and new formats
2. **Phase 2**: Deprecation warnings for legacy format
3. **Phase 3**: Remove legacy support in v1.0.0

### Automatic Migration

```typescript
function migrateLegacyConfig(legacy: TressiConfig): TressiConfig {
  if (detectLegacyMode(legacy)) {
    return {
      ...legacy,
      autoscale: {
        enabled: legacy.autoscale,
        targetRps: legacy.rps,
        maxWorkers: legacy.workers,
        rampUpTime: legacy.rampUpTime,
      },
    };
  }
  return legacy;
}
```

## Mixed Scenario Handling

### Scenario 1: Some Endpoints with Custom Autoscale

- Endpoints with `autoscale` object use per-endpoint settings
- Endpoints without use global defaults
- Global settings provide fallback values

### Scenario 2: Disabled Autoscale for Specific Endpoints

- `autoscale: { enabled: false }` completely disables autoscale
- Uses fixed worker allocation (from global workers setting)

### Scenario 3: Partial Endpoint Configuration

- Missing values inherit from global defaults
- Example: endpoint specifies only `targetRps`, inherits `maxWorkers` from global

## Configuration Validation

### Schema Validation Rules

1. Sum of endpoint weights must be ≤ 1.0
2. Individual endpoint targetRPS must be ≤ global targetRPS
3. minWorkers must be < maxWorkers for each endpoint
4. cooldownPeriod must be ≥ 1 second

### Runtime Validation

- Dynamic weight adjustment if sum > 1.0
- Worker allocation validation
- Cross-endpoint dependency checks

## Performance Considerations

### Memory Optimization

- Lazy initialization of endpoint-specific histograms
- Shared worker pools where possible
- Efficient endpoint key caching

### CPU Optimization

- Batch scaling decisions
- Smart interval scheduling
- Minimal lock contention

### Monitoring & Observability

- Per-endpoint metrics collection
- Scaling event logging
- Performance impact tracking
