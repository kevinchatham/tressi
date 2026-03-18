# Configuration Schema Reference

The Tressi JSON schema defines the structure for test configurations, ensuring valid execution parameters and providing realtime feedback in supported editors. Using the schema prevents runtime errors by validating types, ranges, and required fields before a test begins.

This document covers:

- **Schema Location**: Accessing the schema file for local reference or IDE integration.
- **Global Configuration**: Root properties and execution engine options.
- **Request Parameters**: Endpoint targeting, load profiles, and automated termination logic.

### Schema Location

The schema is located within the project at `projects/cli/tressi.schema.json`. Version-specific schemas are also available on [GitHub](https://github.com/kevinchatham/tressi/tree/main/schemas).

To enable validation and IntelliSense in VS Code or other supported editors, ensure the `$schema` property is at the root of your configuration file:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.17.json",
  "requests": [],
  "options": {}
}
```

### Root Properties

| Property   | Type   | Description                                  |
| ---------- | ------ | -------------------------------------------- |
| `$schema`  | string | URI to the JSON schema for validation.       |
| `requests` | array  | List of endpoint configurations to test.     |
| `options`  | object | Global configuration for the test execution. |

### Global Runner Options

Configure overall test runner behavior using the `options` object.

| Property            | Type    | Description                                                                  |
| ------------------- | ------- | ---------------------------------------------------------------------------- |
| `durationSec`       | integer | Total test duration in seconds. Min: `10`. Default: `10`.                    |
| `rampUpDurationSec` | integer | Global ramp up time in seconds for all endpoints. Default: `0`.              |
| `headers`           | object  | Global headers sent with every request. Default: `{"User-Agent": "Tressi"}`. |
| `threads`           | integer | Number of worker threads. Default: CPU count.                                |
| `workerMemoryLimit` | integer | Memory allocation per worker in MB. Min: `16`, Max: `512`. Default: `128`.   |
| `workerEarlyExit`   | object  | Default [Early Exit Configuration](#automated-test-termination) for workers. |

### Request Endpoints

Define specific endpoints to target within the `requests` array.

| Property            | Type    | Description                                                        |
| ------------------- | ------- | ------------------------------------------------------------------ |
| `url`               | string  | Target URI for the request.                                        |
| `method`            | string  | HTTP method (GET, POST, PUT, PATCH, DELETE). Default: `GET`.       |
| `payload`           | object  | Request body for POST/PUT/PATCH methods.                           |
| `headers`           | object  | Endpoint specific headers. Merged with global headers.             |
| `rps`               | integer | Target requests per second for this endpoint. Default: `1`.        |
| `rampUpDurationSec` | integer | Seconds to reach target RPS. Overrides global ramp up if non-zero. |
| `earlyExit`         | object  | [Early Exit Configuration](#early-exit) for this endpoint.         |

### Early Exit

Set thresholds to stop tests automatically when performance or stability degrades. Review [Automated Test Termination](../03-advanced/01-early-exit.md) for implementation details and best practices.

| Property             | Type    | Description                                                         |
| -------------------- | ------- | ------------------------------------------------------------------- |
| `enabled`            | boolean | Enables or disables early exit monitoring.                          |
| `errorRateThreshold` | number  | Error rate (0.0 to 1.0) that triggers a test stop.                  |
| `exitStatusCodes`    | array   | List of HTTP status codes that trigger an immediate stop.           |
| `monitoringWindowMs` | integer | Rolling time window in milliseconds for calculating the error rate. |

### Next Steps

Explore [Tressi Architecture](../05-internals/01-architecture.md) to understand the high performance execution engine and shared memory synchronization.
