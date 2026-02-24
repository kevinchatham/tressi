# Configuration Schema

Tressi uses a JSON schema to validate configuration files and provide IntelliSense in supported editors.

### Locate the Schema

The schema is located at [`projects/tressi-cli/tressi.schema.json`](projects/tressi-cli/tressi.schema.json).

### Configure Root Properties

| Property   | Type   | Description                                  |
| ---------- | ------ | -------------------------------------------- |
| `$schema`  | string | URI to the JSON schema for validation.       |
| `requests` | array  | List of endpoint configurations to test.     |
| `options`  | object | Global configuration for the test execution. |

### Set Global Runner Options

Configure overall test runner behavior using the `options` object.

| Property            | Type    | Description                                                                         |
| ------------------- | ------- | ----------------------------------------------------------------------------------- |
| `durationSec`       | integer | Total duration of the test in seconds.                                              |
| `rampUpDurationSec` | integer | Global ramp-up time in seconds for all endpoints.                                   |
| `headers`           | object  | Global headers sent with every request.                                             |
| `threads`           | integer | Number of worker threads to spawn. Min: `1`, Max: `os.cpus().length`, Default: `4`. |
| `workerMemoryLimit` | integer | Maximum memory allocation per worker in MB. Min: `16`, Max: `512`, Default: `128`.  |
| `workerEarlyExit`   | object  | Default [Early Exit Configuration](#automate-test-termination) for workers.         |

### Define Request Endpoints

Define specific endpoints to target within the `requests` array.

| Property            | Type    | Description                                                               |
| ------------------- | ------- | ------------------------------------------------------------------------- |
| `url`               | string  | Target URI for the request.                                               |
| `method`            | string  | HTTP method (GET, POST, PUT, PATCH, DELETE). Defaults to GET.             |
| `payload`           | object  | Request body for POST/PUT/PATCH methods.                                  |
| `headers`           | object  | Endpoint-specific headers. Merged with global headers.                    |
| `rps`               | integer | Target requests per second for this endpoint.                             |
| `rampUpDurationSec` | integer | Seconds to reach target RPS. Overrides global ramp up if non zero.        |
| `earlyExit`         | object  | [Early Exit Configuration](#automate-test-termination) for this endpoint. |

### Automate Test Termination

Set thresholds to stop tests automatically when performance or stability degrades. Review [Automated Test Termination](../03-advanced/02-early-exit.md) for implementation details and best practices.

| Property             | Type    | Description                                                         |
| -------------------- | ------- | ------------------------------------------------------------------- |
| `enabled`            | boolean | Enables or disables early exit monitoring.                          |
| `errorRateThreshold` | number  | Error rate (0.0 to 1.0) that triggers a test stop.                  |
| `exitStatusCodes`    | array   | List of HTTP status codes that trigger an immediate stop.           |
| `monitoringWindowMs` | integer | Rolling time window in milliseconds for calculating the error rate. |

### Next Steps

Explore [Tressi Architecture](../05-internals/01-architecture.md) to understand the high-performance execution engine and shared memory synchronization.
