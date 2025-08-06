# CLI to JSON Configuration Migration Guide

## ✅ Migration Complete - Production Ready

**Status**: ✅ **COMPLETED** - The CLI to JSON configuration migration has been fully implemented and is now active in production. All legacy CLI flags (except `--config` and `--no-ui`) have been completely removed from the codebase.

## Overview

Starting with version **0.0.13**, Tressi has migrated from CLI-based configuration to JSON-based configuration. This change provides better configuration management, version control compatibility, and more complex configuration capabilities.

**🚨 Breaking Change**: This migration breaks backwards compatibility. CLI options (except `--config` and `--no-ui`) have been removed in favor of JSON configuration properties.

## Migration Table

The following table maps all CLI options to their corresponding JSON configuration properties:

| CLI Option                     | JSON Property         | Type    | Description                                                          |
| ------------------------------ | --------------------- | ------- | -------------------------------------------------------------------- |
| `--workers <n>`                | `workers`             | number  | Number of concurrent workers, or max workers if autoscale is enabled |
| `--concurrent-requests <n>`    | `concurrentRequests`  | number  | Maximum concurrent requests per worker                               |
| `--duration <s>`               | `duration`            | number  | Duration in seconds                                                  |
| `--ramp-up-time <s>`           | `rampUpTime`          | number  | Time in seconds to ramp up to the target RPS                         |
| `--rps <n>`                    | `rps`                 | number  | Target requests per second                                           |
| `--autoscale`                  | `autoscale`           | boolean | Enable autoscaling of workers                                        |
| `--export [path]`              | `export`              | string  | Export a comprehensive report to a directory                         |
| `--early-exit-on-error`        | `earlyExitOnError`    | boolean | Enable early exit on error conditions                                |
| `--error-rate-threshold <n>`   | `errorRateThreshold`  | number  | Error rate threshold (0.0-1.0) to trigger early exit                 |
| `--error-count-threshold <n>`  | `errorCountThreshold` | number  | Absolute error count threshold to trigger early exit                 |
| `--error-status-codes <codes>` | `errorStatusCodes`    | array   | Array of HTTP status codes that should trigger early exit            |

## Before/After Examples

### Before: CLI Usage

```bash
# Basic load test
tressi --workers 20 --duration 60 --rps 1000

# Autoscaling test
tressi --autoscale --workers 50 --rps 2000 --duration 120 --ramp-up-time 30

# Test with error handling
tressi --workers 10 --duration 300 --rps 500 \
  --early-exit-on-error \
  --error-rate-threshold 0.05 \
  --error-status-codes 500,502,503

# Export results
tressi --workers 15 --duration 180 --rps 750 --export ./reports/load-test-2024
```

### After: JSON Configuration

Create a `tressi.config.json` file:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "workers": 20,
  "duration": 60,
  "rps": 1000,
  "headers": {
    "Content-Type": "application/json"
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

Then run:

```bash
tressi
```

## JSON Schema Additions

The following root-level properties have been added to the JSON schema for version 0.0.13:

```json
{
  "properties": {
    "workers": {
      "type": "number",
      "minimum": 1,
      "description": "Number of concurrent workers, or max workers if autoscale is enabled"
    },
    "concurrentRequests": {
      "type": "number",
      "minimum": 1,
      "description": "Maximum concurrent requests per worker"
    },
    "duration": {
      "type": "number",
      "minimum": 1,
      "description": "Duration in seconds"
    },
    "rampUpTime": {
      "type": "number",
      "minimum": 0,
      "description": "Time in seconds to ramp up to the target RPS"
    },
    "rps": {
      "type": "number",
      "minimum": 1,
      "description": "Target requests per second"
    },
    "autoscale": {
      "type": "boolean",
      "description": "Enable autoscaling of workers"
    },
    "export": {
      "type": "string",
      "description": "Export a comprehensive report to a directory"
    },
    "earlyExitOnError": {
      "type": "boolean",
      "description": "Enable early exit on error conditions"
    },
    "errorRateThreshold": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Error rate threshold (0.0-1.0) to trigger early exit"
    },
    "errorCountThreshold": {
      "type": "number",
      "minimum": 1,
      "description": "Absolute error count threshold to trigger early exit"
    },
    "errorStatusCodes": {
      "type": "array",
      "items": {
        "type": "number",
        "minimum": 100,
        "maximum": 599
      },
      "description": "Array of HTTP status codes that should trigger early exit"
    }
  }
}
```

## Complete Example Configuration

Here's a comprehensive JSON configuration that demonstrates all migrated properties:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",

  "workers": 25,
  "concurrentRequests": 5,
  "duration": 300,
  "rampUpTime": 60,
  "rps": 1500,
  "autoscale": true,
  "export": "./reports/load-test-2024-08-05",
  "earlyExitOnError": true,
  "errorRateThreshold": 0.03,
  "errorCountThreshold": 50,
  "errorStatusCodes": [500, 502, 503, 504],

  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-token-here",
    "User-Agent": "Tressi/0.0.13"
  },

  "requests": [
    {
      "url": "https://api.example.com/users",
      "method": "GET"
    },
    {
      "url": "https://api.example.com/users",
      "method": "POST",
      "payload": {
        "name": "Test User",
        "email": "test@example.com"
      }
    },
    {
      "url": "https://api.example.com/users/123",
      "method": "PUT",
      "payload": {
        "name": "Updated User"
      },
      "headers": {
        "X-Custom-Header": "custom-value"
      }
    }
  ]
}
```

## Migration Steps

1. **Map your existing CLI options** to JSON properties using the migration table above
2. **Copy your existing headers and requests** into the JSON configuration
3. **Test your configuration** by running `tressi` in the same directory as your config file
4. **Update any scripts or CI/CD pipelines** to use the new JSON-based approach

## Version Compatibility

- **Version 0.0.13**: Introduces JSON configuration migration
- **Backwards compatibility**: ❌ Not maintained for CLI options (except `--config` and `--no-ui`)
- **Recommended action**: Migrate all configurations to JSON format
