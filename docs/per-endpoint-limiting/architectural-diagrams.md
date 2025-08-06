# Per-Endpoint Autoscale Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph "Tressi Load Testing System"
        A[Tressi Config] --> B[Config Resolver]
        B --> C[Endpoint Autoscale Manager]
        C --> D[Worker Distribution Engine]
        D --> E[Per-Endpoint Worker Pools]

        F[Metrics Collector] --> C
        E --> F

        G[Scaling Decision Engine] --> C
        H[Legacy Compatibility Layer] --> B

        style A fill:#f9f,stroke:#333
        style C fill:#bbf,stroke:#333
        style E fill:#9f9,stroke:#333
    end
```

## Configuration Flow

```mermaid
flowchart TD
    A[Configuration Input] --> B{Legacy Format?}
    B -->|Yes| C[Migration Layer]
    B -->|No| D[Config Resolver]
    C --> D

    D --> E{Endpoint Config}
    E --> F[Global Defaults]
    E --> G[Per-Endpoint Settings]
    E --> H[Disabled Autoscale]

    F --> I[Apply Global Settings]
    G --> J[Merge with Global]
    H --> K[Fixed Allocation]

    I --> L[Resolved Config]
    J --> L
    K --> L

    style A fill:#f9f,stroke:#333
    style L fill:#9f9,stroke:#333
```

## Worker Distribution Strategies

### Proportional Distribution

```mermaid
pie title Worker Distribution by Weight
    "Health Check (10%)" : 10
    "Users API (40%)" : 40
    "Products API (30%)" : 30
    "Orders API (20%)" : 20
```

### Priority-Based Distribution

```mermaid
graph TD
    A[Total Workers: 100] --> B{Priority Levels}

    B --> C[High Priority<br/>Min: 60%]
    B --> D[Medium Priority<br/>Min: 30%]
    B --> E[Low Priority<br/>Min: 10%]

    C --> F[Critical Endpoints<br/>60 workers]
    D --> G[Standard Endpoints<br/>30 workers]
    E --> H[Background Endpoints<br/>10 workers]

    style C fill:#ff9999,stroke:#333
    style D fill:#ffcc99,stroke:#333
    style E fill:#99ff99,stroke:#333
```

## Runtime Flow

```mermaid
sequenceDiagram
    participant R as Runner
    participant CM as Config Manager
    participant EM as Endpoint Manager
    participant WD as Worker Distributor
    participant WP as Worker Pool
    participant M as Metrics

    R->>CM: Load Configuration
    CM->>CM: Resolve Per-Endpoint Settings
    CM->>EM: Initialize Endpoint Manager
    EM->>WD: Calculate Initial Distribution

    loop Every 2 seconds
        EM->>M: Collect Endpoint Metrics
        M-->>EM: RPS, Latency, Error Rate
        EM->>EM: Evaluate Scaling Needs
        EM->>WD: Request Worker Reallocation
        WD->>WP: Adjust Worker Counts
    end

    WP->>M: Send Performance Data
```

## Data Flow Architecture

```mermaid
graph LR
    subgraph "Configuration Layer"
        A[JSON Config] --> B[Schema Validation]
        B --> C[Config Resolver]
    end

    subgraph "Autoscale Layer"
        C --> D[Endpoint Manager]
        D --> E[Metrics Aggregator]
        E --> F[Scaling Engine]
        F --> D
    end

    subgraph "Execution Layer"
        D --> G[Worker Allocator]
        G --> H[Endpoint Workers]
        H --> I[HTTP Requests]
        I --> J[Response Collector]
        J --> E
    end

    style A fill:#f9f,stroke:#333
    style D fill:#bbf,stroke:#333
    style H fill:#9f9,stroke:#333
```

## Class Architecture

```mermaid
classDiagram
    class Runner {
        -config: TressiConfig
        -endpointManager: EndpointAutoscaleManager
        -workerPools: Map<string, WorkerPool>
        +run(): Promise<void>
        +stop(): void
    }

    class EndpointAutoscaleManager {
        -configs: Map<string, ResolvedEndpointConfig>
        -metrics: Map<string, EndpointMetrics>
        -allocations: Map<string, number>
        +calculateDistribution(): WorkerAllocation[]
        +evaluateScaling(endpointKey): ScalingDecision
        +updateMetrics(endpointKey, metrics): void
    }

    class WorkerPool {
        -endpointKey: string
        -workerCount: number
        -targetRps: number
        +start(): Promise<void>
        +stop(): void
        +scaleWorkers(count): void
    }

    class MetricsCollector {
        -endpointMetrics: Map<string, EndpointMetrics>
        +recordRequest(endpointKey, result): void
        +getCurrentRps(endpointKey): number
        +getErrorRate(endpointKey): number
    }

    class ConfigResolver {
        +resolveGlobal(config): GlobalAutoscaleConfig
        +resolveEndpoint(endpoint, global): ResolvedEndpointConfig
        +validateWeights(endpoints): boolean
    }

    Runner --> EndpointAutoscaleManager
    Runner --> WorkerPool
    EndpointAutoscaleManager --> WorkerPool
    EndpointAutoscaleManager --> MetricsCollector
    EndpointAutoscaleManager --> ConfigResolver
```

## State Management

```mermaid
stateDiagram-v2
    [*] --> LoadingConfig

    LoadingConfig --> ResolvingEndpoints
    ResolvingEndpoints --> InitializingWorkers

    InitializingWorkers --> Monitoring

    Monitoring --> EvaluatingScale

    EvaluatingScale --> ScalingUp : RPS < threshold
    EvaluatingScale --> ScalingDown : RPS > threshold
    EvaluatingScale --> Monitoring : No change needed

    ScalingUp --> Cooldown
    ScalingDown --> Cooldown

    Cooldown --> Monitoring

    Monitoring --> Stopping : Test complete
    Stopping --> [*]
```

## Error Handling Flow

```mermaid
flowchart TD
    A[Error Detected] --> B{Endpoint Specific?}

    B -->|Yes| C[Apply Endpoint Rules]
    B -->|No| D[Apply Global Rules]

    C --> E{Scale Down?}
    D --> E

    E -->|Yes| F[Reduce Workers]
    E -->|No| G[Maintain Workers]

    F --> H[Log Scaling Event]
    G --> H

    H --> I[Update Metrics]
    I --> J[Continue Monitoring]

    style A fill:#ff9999,stroke:#333
    style F fill:#ffcc99,stroke:#333
    style J fill:#99ff99,stroke:#333
```
