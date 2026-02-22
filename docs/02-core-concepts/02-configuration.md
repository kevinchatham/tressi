# Configuration Guide

Tressi configurations define the parameters and targets for a load test. While these are typically managed through the web interface, they can be loaded from local JSON files or remote URLs and executed via the CLI.

## Configuration Structure

A Tressi configuration is divided into global options and specific request targets.

### Global Options

Global settings define the environment and execution constraints for the entire test.

- **Duration**: The total time the test will run (minimum 10 seconds).
- **Global Headers**: Standard headers applied to all requests. Tressi includes `User-Agent: Tressi` by default.
- **Worker Threads**: The number of parallel cores utilized to generate load. Increasing threads allows work to be distributed evenly across CPU cores, ensuring high RPS targets are met without saturating the generator.
- **Worker Memory Limit**: The maximum memory (MB) allocated per worker thread (16MB - 512MB).
- **Worker Early Exit**: A safety mechanism that provides default thresholds for all endpoints. It stops individual endpoints if their error rate thresholds are exceeded or specific HTTP status codes are encountered.

### Request Configuration

Each target endpoint can be configured with its own performance profile.

- **Target RPS**: The desired requests per second for the specific endpoint.
- **Payloads & Methods**: Support for standard HTTP verbs and JSON payloads (objects or arrays).
- **Early Exit**: Safety thresholds that stop the individual endpoint if error rates exceed acceptable limits or specific status codes are returned.

## Configuration Hierarchy

Tressi uses a hierarchical model for settings. This allows for broad defaults with specific overrides.

- **Headers**: Endpoint-specific headers are merged with global headers. If a key exists in both, the endpoint-specific header takes precedence.
- **Early Exit**: Worker early exit settings act as the default for all endpoints. If an endpoint defines its own `earlyExit` configuration, it overrides the global settings for that specific target. The entire test only terminates early if all endpoints have been stopped.

## ramp up Dynamics

To ensure system stability and accurate telemetry, Tressi supports a linear ramp up period.

- **Linear Progression**: Load increases steadily from zero to the target RPS over the specified ramp up duration.
- **Metric Accuracy**: For the most reliable performance analysis, the ramp up period should not exceed **25% (one quarter)** of the total test duration. This ensures a sufficient window of "Constant Load" to validate sustained performance.
- **RPS Constraints**: When a global ramp up is active, all endpoints must have a target of at least **5 RPS** to ensure smooth linear progression.

## Type Safety & Validation

For users managing configurations as code, Tressi provides a versioned JSON Schema hosted on GitHub. This ensures that your configuration remains compatible with the specific version of the Tressi CLI you have installed.

- **Validation**: Ensures all required fields are present and types are correct before execution.
- **IDE Integration**: Provides autocompletion and documentation tooltips in editors like VS Code when the `$schema` property is defined.
- **Versioning**: Always use the schema version that matches your Tressi installation to ensure access to the correct features and constraints.

## Example Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "requests": [
    {
      "url": "https://api.example.com/v1/users",
      "method": "GET",
      "rps": 100,
      "payload": {},
      "headers": {
        "X-Endpoint-Specific": "true"
      },
      "rampUpDurationSec": 0,
      "earlyExit": {
        "enabled": false,
        "errorRateThreshold": 0,
        "exitStatusCodes": [],
        "monitoringWindowMs": 1000
      }
    },
    {
      "url": "https://api.example.com/v1/auth",
      "method": "POST",
      "rps": 10,
      "payload": {
        "username": "test"
      },
      "headers": {},
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
    "durationSec": 300,
    "rampUpDurationSec": 30,
    "threads": 8,
    "workerMemoryLimit": 128,
    "headers": {
      "Authorization": "Bearer <token>"
    },
    "workerEarlyExit": {
      "enabled": true,
      "errorRateThreshold": 0.1,
      "exitStatusCodes": [500, 503],
      "monitoringWindowMs": 5000
    }
  }
}
```
