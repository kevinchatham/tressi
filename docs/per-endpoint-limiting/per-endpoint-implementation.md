# Per-Endpoint Autoscale Implementation Strategy

## JSON Schema Definition

### Complete Schema Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/TressiConfigSchema",
  "definitions": {
    "AutoscaleConfig": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Enable or disable autoscaling for this endpoint"
        },
        "targetRps": {
          "type": "integer",
          "minimum": 1,
          "description": "Target requests per second for this endpoint"
        },
        "maxWorkers": {
          "type": "integer",
          "minimum": 1,
          "description": "Maximum number of workers for this endpoint"
        },
        "minWorkers": {
          "type": "integer",
          "minimum": 1,
          "description": "Minimum number of workers for this endpoint"
        },
        "rampUpTime": {
          "type": "integer",
          "minimum": 0,
          "description": "Time in seconds to ramp up to target RPS"
        },
        "scaleUpThreshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.9,
          "description": "Percentage of target RPS that triggers scale-up"
        },
        "scaleDownThreshold": {
          "type": "number",
          "minimum": 1,
          "description": "Percentage of target RPS that triggers scale-down"
        },
        "scaleUpFactor": {
          "type": "number",
          "minimum": 0.1,
          "maximum": 1,
          "default": 0.25,
          "description": "Percentage of current workers to add when scaling up"
        },
        "scaleDownFactor": {
          "type": "number",
          "minimum": 0.1,
          "maximum": 1,
          "default": 0.25,
          "description": "Percentage of current workers to remove when scaling down"
        },
        "cooldownPeriod": {
          "type": "integer",
          "minimum": 1,
          "default": 2,
          "description": "Seconds to wait between scaling actions"
        }
      },
      "required": ["enabled"]
    },
    "EndpointAutoscaleConfig": {
      "allOf": [
        { "$ref": "#/definitions/AutoscaleConfig" },
        {
          "type": "object",
          "properties": {
            "weight": {
              "type": "number",
              "minimum": 0.1,
              "maximum": 1,
              "description": "Relative weight for RPS distribution among endpoints"
            },
            "priority": {
              "type": "string",
              "enum": ["high", "medium", "low"],
              "default": "medium",
              "description": "Priority level for worker allocation"
            }
          }
        }
      ]
    },
    "GlobalAutoscaleConfig": {
      "allOf": [
        { "$ref": "#/definitions/AutoscaleConfig" },
        {
          "type": "object",
          "properties": {
            "distributionStrategy": {
              "type": "string",
              "enum": ["proportional", "equal", "priority-based"],
              "default": "proportional",
              "description": "How to distribute workers among endpoints"
            },
            "defaultWeight": {
              "type": "number",
              "minimum": 0.1,
              "maximum": 1,
              "default": 1,
              "description": "Default weight for endpoints without specific weight"
            }
          }
        }
      ]
    },
    "RequestConfigSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "minLength": 1,
          "format": "uri"
        },
        "payload": {
          "anyOf": [
            { "type": "object", "additionalProperties": {} },
            { "type": "array", "items": {} }
          ]
        },
        "method": {
          "type": "string",
          "enum": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
          "default": "GET"
        },
        "headers": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        },
        "autoscale": {
          "$ref": "#/definitions/EndpointAutoscaleConfig"
        }
      },
      "required": ["url"]
    },
    "TressiConfigSchema": {
      "type": "object",
      "properties": {
        "$schema": { "type": "string" },
        "headers": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        },
        "requests": {
          "type": "array",
          "items": { "$ref": "#/definitions/RequestConfigSchema" },
          "minItems": 1
        },
        "workers": { "type": "integer", "exclusiveMinimum": 0 },
        "concurrentRequests": { "type": "integer", "exclusiveMinimum": 0 },
        "duration": { "type": "integer", "exclusiveMinimum": 0 },
        "rampUpTime": { "type": "integer", "minimum": 0 },
        "rps": { "type": "integer", "exclusiveMinimum": 0 },
        "autoscale": {
          "anyOf": [
            { "type": "boolean" },
            { "$ref": "#/definitions/GlobalAutoscaleConfig" }
          ]
        },
        "export": { "type": "string", "minLength": 1 },
        "earlyExitOnError": { "type": "boolean" },
        "errorRateThreshold": { "type": "number", "minimum": 0, "maximum": 1 },
        "errorCountThreshold": { "type": "integer", "exclusiveMinimum": 0 },
        "errorStatusCodes": {
          "type": "array",
          "items": { "type": "integer", "minimum": 100, "maximum": 599 }
        }
      },
      "required": ["requests"]
    }
  }
}
```

## Implementation Classes

### Core Data Structures

```typescript
// src/types/autoscale.ts
export interface EndpointMetrics {
  endpointKey: string;
  currentRps: number;
  targetRps: number;
  avgLatency: number;
  errorRate: number;
  workerCount: number;
  lastScaleTime: number;
  requestsMade: number;
  requestsSucceeded: number;
  requestsFailed: number;
}

export interface ScalingDecision {
  endpointKey: string;
  action: 'scale-up' | 'scale-down' | 'maintain';
  workers: number;
  reason: string;
  timestamp: number;
}

export interface WorkerAllocation {
  endpointKey: string;
  workerCount: number;
  targetRps: number;
  currentRps: number;
}
```

### Configuration Resolver

```typescript
// src/config/autoscale-resolver.ts
export class AutoscaleConfigResolver {
  resolveEndpointConfig(
    endpoint: RequestConfig,
    globalConfig: TressiConfig,
  ): ResolvedEndpointConfig {
    const globalAutoscale = this.normalizeGlobalAutoscale(
      globalConfig.autoscale,
    );

    if (endpoint.autoscale?.enabled === false) {
      return {
        enabled: false,
        useGlobalWorkers: true,
      };
    }

    if (endpoint.autoscale?.enabled === true) {
      return {
        enabled: true,
        ...globalAutoscale,
        ...endpoint.autoscale,
        endpointKey: this.generateEndpointKey(endpoint),
      };
    }

    if (globalAutoscale.enabled) {
      return {
        enabled: true,
        ...globalAutoscale,
        endpointKey: this.generateEndpointKey(endpoint),
        weight: globalAutoscale.defaultWeight || 1,
      };
    }

    return { enabled: false };
  }
}
```

### Endpoint Autoscale Manager

```typescript
// src/autoscale/endpoint-manager.ts
export class EndpointAutoscaleManager extends EventEmitter {
  private endpointConfigs: Map<string, ResolvedEndpointConfig>;
  private workerAllocations: Map<string, number>;
  private endpointMetrics: Map<string, EndpointMetrics>;
  private scalingIntervals: Map<string, NodeJS.Timeout>;
  private globalWorkerLimit: number;

  constructor(
    private config: TressiConfig,
    private requests: RequestConfig[],
  ) {
    super();
    this.initializeEndpoints();
  }

  calculateWorkerDistribution(): WorkerAllocation[] {
    const activeEndpoints = this.getActiveEndpoints();
    const totalWorkers = this.globalWorkerLimit;

    switch (this.config.autoscale.distributionStrategy) {
      case 'proportional':
        return this.calculateProportionalDistribution(
          activeEndpoints,
          totalWorkers,
        );
      case 'priority-based':
        return this.calculatePriorityDistribution(
          activeEndpoints,
          totalWorkers,
        );
      case 'equal':
        return this.calculateEqualDistribution(activeEndpoints, totalWorkers);
      default:
        return this.calculateProportionalDistribution(
          activeEndpoints,
          totalWorkers,
        );
    }
  }

  private calculateProportionalDistribution(
    endpoints: ResolvedEndpointConfig[],
    totalWorkers: number,
  ): WorkerAllocation[] {
    const totalWeight = endpoints.reduce(
      (sum, ep) => sum + (ep.weight || 1),
      0,
    );

    return endpoints.map((endpoint) => {
      const proportion = (endpoint.weight || 1) / totalWeight;
      const workerCount = Math.max(
        endpoint.minWorkers || 1,
        Math.min(
          Math.round(totalWorkers * proportion),
          endpoint.maxWorkers || totalWorkers,
        ),
      );

      return {
        endpointKey: endpoint.endpointKey!,
        workerCount,
        targetRps: endpoint.targetRps!,
        currentRps: this.getCurrentRps(endpoint.endpointKey!),
      };
    });
  }
}
```

### Modified Runner Integration

```typescript
// src/runner/endpoint-runner.ts
export class EndpointRunner extends EventEmitter {
  private endpointManager: EndpointAutoscaleManager;
  private endpointWorkers: Map<string, WorkerPool>;
  private globalMetrics: GlobalMetricsCollector;

  async runPerEndpointAutoscale(): Promise<void> {
    this.startEndpointMetricsCollection();
    this.startEndpointScalingIntervals();

    const workerAllocations =
      this.endpointManager.calculateWorkerDistribution();
    await this.allocateWorkers(workerAllocations);

    await Promise.all(
      Array.from(this.endpointWorkers.values()).map((pool) => pool.start()),
    );
  }

  private startEndpointScalingIntervals(): void {
    this.endpointManager.getActiveEndpoints().forEach((endpoint) => {
      const interval = setInterval(() => {
        this.evaluateEndpointScaling(endpoint.endpointKey!);
      }, endpoint.cooldownPeriod * 1000);

      this.endpointManager.setScalingInterval(endpoint.endpointKey!, interval);
    });
  }
}
```

## Migration Examples

### From Legacy to New Format

**Legacy Configuration:**

```json
{
  "autoscale": true,
  "workers": 50,
  "rps": 1000,
  "rampUpTime": 15,
  "requests": [...]
}
```

**Migrated Configuration:**

```json
{
  "autoscale": {
    "enabled": true,
    "targetRps": 1000,
    "maxWorkers": 50,
    "rampUpTime": 15,
    "distributionStrategy": "proportional",
    "defaultWeight": 1
  },
  "requests": [...]
}
```

### Advanced Migration with Per-Endpoint Settings

**Legacy:**

```json
{
  "autoscale": true,
  "workers": 100,
  "rps": 2000,
  "requests": [
    { "url": "/api/fast", "method": "GET" },
    { "url": "/api/slow", "method": "POST" }
  ]
}
```

**Migrated with Optimization:**

```json
{
  "autoscale": {
    "enabled": true,
    "targetRps": 2000,
    "maxWorkers": 100,
    "distributionStrategy": "proportional"
  },
  "requests": [
    {
      "url": "/api/fast",
      "method": "GET",
      "autoscale": {
        "enabled": true,
        "targetRps": 1500,
        "weight": 0.75,
        "priority": "high"
      }
    },
    {
      "url": "/api/slow",
      "method": "POST",
      "autoscale": {
        "enabled": true,
        "targetRps": 500,
        "weight": 0.25,
        "priority": "medium",
        "minWorkers": 5
      }
    }
  ]
}
```

## Testing Strategy

### Unit Tests

- Configuration resolution logic
- Worker distribution calculations
- Scaling decision algorithms
- Backward compatibility validation

### Integration Tests

- Mixed endpoint configurations
- Performance impact measurement
- Resource allocation accuracy
- Error handling scenarios

### Load Testing

- Compare legacy vs new performance
- Validate per-endpoint isolation
- Measure overhead of new system
- Stress test with 100+ endpoints
