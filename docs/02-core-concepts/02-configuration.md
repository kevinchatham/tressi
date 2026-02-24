# Configuration Guide

Tressi configurations define the parameters and targets for a load test. While these are typically managed through the web interface, they can be loaded from local JSON files or remote URLs and executed via the CLI.

## Configuration Structure

A Tressi configuration is divided into global options and specific request targets.

### Global Options

Global settings define the environment and execution constraints for the entire test. These include the total test duration, global headers, and resource allocation for worker threads.

### Request Configuration

Each target endpoint is defined within the `requests` array. This allows for independent control over the HTTP method, payload, and target throughput for every endpoint in the test suite.

## Configuration Hierarchy

Tressi uses a hierarchical model for settings, allowing broad defaults with specific overrides.

- **Headers**: Endpoint specific headers take precedence over global headers.
- **Early Exit**: Endpoint configurations override global `workerEarlyExit` settings.

## Ramp Up Dynamics

Tressi supports linear load progression to stabilize target systems before reaching peak intensity. Review [Configuring Load Progression](../03-advanced/01-ramp-up-dynamics.md) for detailed methodology and constraints.

## Validate Configurations

Tressi utilizes a JSON Schema to validate configurations and provide IDE IntelliSense. Review the [Configuration Schema](../04-reference/02-schema.md) for property definitions and validation rules.

## Configuration Example

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "requests": [
    {
      "url": "https://api.example.com/v1/users",
      "method": "GET",
      "rps": 100
    }
  ],
  "options": {
    "durationSec": 300,
    "threads": 8
  }
}
```

### Next Steps

Review the [Execution Lifecycle](./03-execution-lifecycle.md) to understand how Tressi runs your tests.
