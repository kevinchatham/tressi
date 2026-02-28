# Configure Load Tests

Tressi configurations define execution parameters and targets. While the web interface provides a visual configuration builder to generate schema compliant JSON, configurations can also be managed via local files or remote URLs for CLI execution. Using the visual builder ensures all required properties are defined, preventing validation errors during execution.

This document covers:

- **Schema & Targets**: Using JSON schemas for type safety and defining independent control over endpoint behavior.
- **Global & Advanced Options**: Establishing environment constraints and implementing linear load progression.
- **Settings Hierarchy**: Understanding how endpoint specific configurations override global options.

### Schema Validation

The `$schema` property enables type safety for IDE edits and UI exports. This provides validation and IntelliSense for all properties, ensuring configuration accuracy outside of the web interface. Review the [Configuration Schema](../04-reference/02-schema.md) for property definitions.

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json"
}
```

> **Note**: The Tressi schema requires explicit definition of all properties. Using the web interface is recommended to generate valid configurations.

### Configure Request Targets

Define specific target behavior within the `requests` array. This provides independent control over the HTTP method, payload, and target throughput (RPS) for every endpoint in the test.

```json
{
  "requests": [
    {
      "url": "http://api.example.com/v1",
      "method": "POST",
      "payload": {
        "hello": true
      },
      "headers": {
        "User-Agent": "Tressi"
      },
      "rps": 100,
      "rampUpDurationSec": 0,
      "earlyExit": {
        "enabled": false,
        "errorRateThreshold": 0,
        "exitStatusCodes": [],
        "monitoringWindowMs": 1000
      }
    }
  ]
}
```

### Define Global Options

Global settings establish environment constraints for the entire test suite. Use these to set total test duration, global HTTP headers, and resource allocation for worker threads.

```json
{
  "options": {
    "durationSec": 300,
    "threads": 8,
    "workerMemoryLimit": 128,
    "headers": {
      "Authorization": "Bearer <token>"
    }
  }
}
```

### Control Load Progression

Implement linear load progression to stabilize target systems before reaching peak intensity. See [Control Load Progression](../03-advanced/01-ramp-up-dynamics.md) for methodology and constraints.

```json
{
  "requests": [
    {
      "url": "http://api.example.com/v1",
      "rps": 1000,
      "rampUpDurationSec": 30
    }
  ],
  "options": {
    "durationSec": 300,
    "rampUpDurationSec": 60
  }
}
```

### Manage Settings Hierarchy

Endpoint specific configurations take precedence over global `options` for granular control. This hierarchy applies to:

- **Headers** (`headers`)
- **Load Progression** (`rampUpDurationSec`)
- **Early Exit** (`earlyExit` overrides `workerEarlyExit`)

```json
{
  "requests": [
    {
      "url": "http://api.example.com/v1",
      "rampUpDurationSec": 30,
      "headers": {
        "X-Target-ID": "endpoint-01"
      }
    }
  ],
  "options": {
    "rampUpDurationSec": 60,
    "headers": {
      "User-Agent": "Tressi-Global-Runner"
    }
  }
}
```

### Full Example

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "requests": [
    {
      "url": "http://localhost:5000/health",
      "payload": {},
      "method": "GET",
      "headers": {
        "User-Agent": "Tressi"
      },
      "rps": 100,
      "rampUpDurationSec": 0,
      "earlyExit": {
        "enabled": false,
        "errorRateThreshold": 0,
        "exitStatusCodes": [],
        "monitoringWindowMs": 1000
      }
    },
    {
      "url": "http://localhost:5000/echo",
      "payload": {
        "hello": true
      },
      "method": "POST",
      "headers": {
        "User-Agent": "Tressi"
      },
      "rps": 10,
      "rampUpDurationSec": 0,
      "earlyExit": {
        "enabled": false,
        "errorRateThreshold": 0,
        "exitStatusCodes": [],
        "monitoringWindowMs": 1000
      }
    }
  ],
  "options": {
    "durationSec": 10,
    "rampUpDurationSec": 0,
    "headers": {
      "User-Agent": "Tressi"
    },
    "threads": 4,
    "workerMemoryLimit": 128,
    "workerEarlyExit": {
      "enabled": false,
      "errorRateThreshold": 0,
      "exitStatusCodes": [],
      "monitoringWindowMs": 1000
    }
  }
}
```

### Next Steps

Review the [Execution Lifecycle](./03-execution-lifecycle.md) to understand how Tressi processes these configurations.
