<p align="center">
  <img src="https://github.com/kevinchatham/tressi/blob/main/images/tressi-logo.png?raw=true" alt="tressi-logo" width="150px" height="150px"/>
  <br/>
  <em>Stress less, test more.</em>
  <br/><br/>
  <a href="./docs/01-home/03-license.md">
    <img src="https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-orange" alt="Source Available"/>
  </a>
</p>

`tressi` is a **lightweight, declarative load testing tool** built for modern developers. Define your HTTP workflows in a simple JSON config file and unleash them with blazing concurrency, live terminal metrics, and full data exports. Use it as a CLI or embed it into your own tooling.

## 🚀 Features

- 📝 **Declarative JSON Config** — Define tests in a simple JSON file with version-aligned JSON schema for validation.
- ⚡️ **Target-based Load Testing** - Always uses dynamic worker scaling to meet your target load.
- 📊 **Interactive Terminal UI** — View live requests per second, latency stats, and status codes.
- 📁 **Comprehensive Reporting** — Export results to Markdown and XLSX for analysis.

## 📦 Installation

You can install and use `tressi` in three different ways:

### 1. As a Package (for local development or programmatic use)

```bash
npm install tressi
```

### 2. As a CLI Tool (without installing)

Run directly using `npx`:

```bash
npx tressi run ./tressi.config.json
```

### 3. Global Installation (for CLI use everywhere)

Install globally to run `tressi` from anywhere:

```bash
npm install -g tressi
```

## 🛠️ Quick Start

1. **Create a configuration file**

Create a `tressi.config.json` file in your project directory:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

2. **Run the test**

With your configuration file in place, simply run:

```bash
npx tressi run ./tressi.config.json
```

## 📊 Live Terminal UI

When you run `tressi`, it displays a live dashboard with four key sections:

<p align="center">
  <img src="https://github.com/kevinchatham/tressi/blob/main/images/tressi-ui.png?raw=true" alt="tressi-ui" width="90%"/>
</p>

### How to Interpret the Dashboard

1.  **Avg Latency (ms) (Top-Left)**
    - **What it is:** A line chart showing the average latency (in milliseconds) over a rolling time window. Each point on the graph represents the average latency of all requests that completed within that time slice.
    - **What to look for:** A steady, low line is ideal. Sudden spikes or a consistently rising trend can indicate performance bottlenecks under load.

2.  **Response Codes Over Time (Top-Right)**
    - **What it is:** A line chart that tracks the count of different response code categories (2xx, 3xx, 4xx, 5xx) over the course of the test. The x-axis shows the elapsed time in seconds.
    - **What to look for:** The appearance of red (4xx/5xx) lines, which signals that errors started occurring at a specific point in time during the test.

3.  **Live Stats (Bottom-Left)**
    - **What it is:** A table of key performance indicators (KPIs) for the entire test run so far.
    - **Key Stats:**
      - `Time`: Elapsed time versus the total test duration.
      - `Workers`: The current number of active concurrent workers.
      - `Req/s`: The actual requests per second versus your target.
      - `Success / Fail`: Total count of successful versus failed requests.
      - `Avg Latency`: The average latency across all requests.

4.  **Latency Distribution (Bottom-Right)**
    - **What it is:** A histogram that groups all completed requests into latency buckets (e.g., 17-42ms, 43-68ms).
    - **What to look for:** This shows you where the majority of your response times are concentrated. An ideal result is a tight grouping in the lowest buckets. A wide spread indicates inconsistent performance.

## ⚙️ Usage & Examples

### Worker Threads Mode

`tressi` now supports **worker threads** for true multi-core utilization, providing significant performance improvements over the traditional async/event-loop architecture. Worker threads enable:

- **True parallel execution** across all CPU cores
- **Precise RPS control** with per-worker rate limiting
- **Zero copy shared memory** for real-time metrics
- **Coordinated early exit** across all workers
- **Deterministic timing** with sub-millisecond accuracy

#### Enabling Worker Threads

Simply add the `threads` option to your configuration:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 4,
    "durationSec": 30,
    "rps": 1000
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

#### Worker Threads Configuration

**Basic Worker Setup:**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 8,
    "workerMemoryLimit": 256,
    "durationSec": 60,
    "rps": 2000
  },
  "requests": [
    {
      "url": "https://api.example.com/load-test",
      "method": "GET"
    }
  ]
}
```

**Coordinated Early Exit with Worker Threads:**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 4,
    "durationSec": 120,
    "rps": 500,
    "workerEarlyExit": {
      "enabled": true,
      "globalErrorRateThreshold": 0.05,
      "globalErrorCountThreshold": 100,
      "monitoringWindowMs": 1000,
      "stopMode": "global"
    }
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

**Per-endpoint Early Exit:**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 6,
    "durationSec": 300,
    "rps": 300,
    "workerEarlyExit": {
      "enabled": true,
      "perEndpointThresholds": [
        {
          "url": "https://api.example.com/critical-endpoint",
          "errorRateThreshold": 0.01,
          "errorCountThreshold": 10
        }
      ],
      "stopMode": "endpoint"
    }
  },
  "requests": [
    {
      "url": "https://api.example.com/critical-endpoint",
      "method": "GET"
    }
  ]
}
```

### Performance Comparison

| Metric          | Async Mode       | Worker Threads      | Improvement     |
| --------------- | ---------------- | ------------------- | --------------- |
| RPS Accuracy    | ±15% variance    | ±2% variance        | 7.5x better     |
| CPU Utilization | 100% single core | 400-800% multi-core | 4-8x better     |
| Timer Jitter    | 5-15ms           | <1ms                | 5-15x better    |
| Memory Usage    | ~50MB baseline   | ~50MB + 5MB/worker  | Scales linearly |

### Test Scenarios

`tressi` can be configured to simulate a variety of load testing scenarios. All configuration is done through your JSON config file. Here are examples for different test types:

#### Basic Load Test

A straightforward test with a fixed number of workers and a target load:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 10,
    "durationSec": 30,
    "rps": 200
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

Run with:

```bash
npx tressi run ./tressi.config.json
```

#### Ramp up Load Test

Gradually increases the load to your target requests per second over a specified duration:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 20,
    "durationSec": 60,
    "rps": 500,
    "rampUpDurationSec": 30
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

#### Spike Test

A short, intense burst of traffic to test your system's ability to handle sudden surges:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 100,
    "durationSec": 10
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

#### Soak Test (Endurance Test)

A long-running test to check for performance degradation, memory leaks, or other issues over an extended period:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 5,
    "durationSec": 300,
    "rps": 50
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

#### Target-based Load Test

Dynamically adjusts the number of workers to meet your target load, up to the specified maximum workers:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 50,
    "durationSec": 60,
    "rps": 1000
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

#### Headless & Export Test

Runs a test without the UI and exports the results to a specified directory:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 20,
    "durationSec": 30,
    "rps": 300,
    "useUI": false,
    "exportPath": "my-test-results"
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

#### Early Exit Tests

Stop tests automatically when error thresholds are exceeded to save time and resources.

**Exit on error rate threshold (5%):**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 10,
    "durationSec": 60,
    "rps": 100,
    "earlyExitOnError": true,
    "errorRateThreshold": 0.05
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

**Exit on error count threshold (50 errors):**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 20,
    "durationSec": 120,
    "rps": 200,
    "earlyExitOnError": true,
    "errorCountThreshold": 50
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

**Exit on specific status codes:**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 15,
    "durationSec": 90,
    "rps": 150,
    "earlyExitOnError": true,
    "errorStatusCodes": [500, 503, 404]
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

**Combined early exit conditions:**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 25,
    "durationSec": 180,
    "rps": 300,
    "earlyExitOnError": true,
    "errorRateThreshold": 0.1,
    "errorCountThreshold": 100,
    "errorStatusCodes": [500, 503]
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

### Configuration Reference

Create a `tressi.config.json` file with a `$schema` property. This property points to a JSON Schema file that provides autocompletion and validation in supported editors (like VS Code), making it easier to write valid configurations.

#### Example Configurations

**Minimal Configuration**:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "requests": [
    {
      "url": "https://api.example.com/users",
      "method": "GET"
    },
    {
      "url": "https://api.example.com/users",
      "method": "POST",
      "payload": { "name": "Tressi" }
    }
  ]
}
```

**Full Configuration**:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 10,
    "durationSec": 30,
    "rampUpDurationSec": 0,
    "rps": 200,
    "exportPath": null,
    "useUI": true,
    "silent": false,
    "earlyExitOnError": false,
    "errorRateThreshold": null,
    "errorCountThreshold": null,
    "errorStatusCodes": [],
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer <your-token>"
    }
  },
  "requests": [
    {
      "url": "https://api.example.com/users",
      "method": "GET"
    },
    {
      "url": "https://api.example.com/users",
      "method": "POST",
      "payload": { "name": "Tressi" },
      "headers": {
        "Content-Type": "application/vnd.api+json"
      }
    }
  ]
}
```

#### Configuration Options

All test configuration is now done through the JSON configuration file. The `options` object supports the following properties:

| Property              | Type                  | Description                                                                   | Default |
| --------------------- | --------------------- | ----------------------------------------------------------------------------- | ------- |
| `workers`             | `integer`             | Maximum number of concurrent workers to use for dynamic scaling               | `10`    |
| `durationSec`         | `integer`             | Total test duration in seconds                                                | `10`    |
| `rampUpDurationSec`   | `integer`             | Time in seconds to ramp up to the target load                                 | `0`     |
| `rps`                 | `number`              | Target requests per second (ramps up to this value)                           | `1`     |
| `threads`             | `integer`             | Number of worker threads to use (defaults to CPU count, max: CPU cores)       |         |
| `workerMemoryLimit`   | `integer`             | Memory limit per worker in MB (16-512)                                        | `128`   |
| `workerEarlyExit`     | `object`              | Coordinated early exit configuration for worker threads                       | `{}`    |
| `exportPath`          | `string` or `boolean` | Export results to Markdown and XLSX. Use `true` for default or specify a path |         |
| `useUI`               | `boolean`             | Enable the interactive terminal UI                                            | `true`  |
| `silent`              | `boolean`             | Suppress all console output                                                   | `false` |
| `earlyExitOnError`    | `boolean`             | Enable early exit when error thresholds are exceeded                          | `false` |
| `errorRateThreshold`  | `number`              | Exit when error rate exceeds this value (0.0-1.0)                             |         |
| `errorCountThreshold` | `integer`             | Exit when total error count reaches this number                               |         |
| `errorStatusCodes`    | `array`               | Array of status codes that trigger early exit                                 | `[]`    |
| `headers`             | `object`              | Global headers to be sent with every request                                  | `{}`    |

#### Root Properties

| Property   | Type     | Description                                                                        |
| ---------- | -------- | ---------------------------------------------------------------------------------- |
| `options`  | `object` | Configuration options for the test runner                                          |
| `requests` | `array`  | A required array of one or more request objects to be executed by the test runner. |

#### Request Properties

Each object in the `requests` array defines a single HTTP request and has the following properties:

| Property  | Type                | Description                                                                                                                                                |
| --------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`     | `string`            | The full URL to send the request to.                                                                                                                       |
| `method`  | `string`            | (Optional) The HTTP method. It is case-insensitive, defaults to `GET`, and supports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.        |
| `payload` | `object` or `array` | (Optional) The JSON data to send as the request body.                                                                                                      |
| `headers` | `object`            | (Optional) An object containing headers for this specific request. If a header is defined here and in the global `headers`, this one will take precedence. |

### Exporting Results

Configure export settings in your JSON configuration file using the `exportPath` option:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "workers": 20,
    "durationSec": 30,
    "rps": 300,
    "useUI": false,
    "exportPath": "my-test-results"
  },
  "requests": [
    {
      "url": "https://api.example.com/endpoint",
      "method": "GET"
    }
  ]
}
```

When `exportPath` is set to `true` or a string value, tressi will generate a unique, timestamped directory containing:

- **📝 `report.md`**: A clean, readable Markdown summary of the test results. It includes a "Sampled Responses" section that provides a response body for each unique status code received _per endpoint_, making it easy to debug different outcomes for the same URL.
- **📊 `report.xlsx`**: A multi-sheet Excel file with the global summary, per-endpoint summary, a raw request log, and a dedicated "Sampled Responses" sheet that lists one sample for each status code received per endpoint.

The directory will be named with a timestamp, such as `my-test-results-2025-07-06T10:00:00.000Z`.

### CLI Commands

| Command        | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `run <config>` | Run a load test using the specified configuration file (local or remote) |
| `serve`        | Start the Tressi Hono server (Web UI & API)                              |
| `reset`        | Completely reset the Tressi database                                     |

Starting in `0.0.13`, `tressi` now uses a simplified CLI interface. All configuration options have been moved to the JSON configuration file for better maintainability and validation.

## 🧬 Programmatic Usage

`tressi` can be used as a library to run load tests from your own Node.js scripts. The `runLoadTest` function accepts a `TressiConfig` object and returns a `Promise` that resolves with a `TestSummary` object containing detailed results.

```ts
import { runLoadTest, TestSummary, TressiConfig } from 'tressi';

async function myCustomScript() {
  console.log('Starting custom load test...');

  const config: TressiConfig = {
    $schema:
      'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
    options: {
      workers: 5,
      durationSec: 10,
      rps: 100, // Target 100 requests/second
      silent: true, // Suppress all console output from tressi
    },
    requests: [{ url: 'https://api.example.com/health', method: 'GET' }],
  };

  const summary: TestSummary = await runLoadTest(config);

  console.log('Test complete. Analyzing results...');

  // Now you can use the summary object for custom logic
  if (summary.global.avgLatencyMs > 500) {
    console.error(`High latency detected: ${summary.global.avgLatencyMs}ms!`);
    // You could trigger an alert or fail a CI/CD pipeline here
  }

  if (summary.global.failedRequests > 0) {
    console.error(`${summary.global.failedRequests} requests failed!`);
  }

  console.log('Custom script finished.');
}

myCustomScript();
```

### Early Exit in Programmatic Usage

You can also use early exit functionality programmatically to automatically stop tests when error conditions are met:

```ts
import { runLoadTest, TestSummary, TressiConfig } from 'tressi';

async function earlyExitTest() {
  console.log('Starting load test with early exit...');

  try {
    const config: TressiConfig = {
      $schema:
        'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
      options: {
        workers: 10,
        durationSec: 120,
        rps: 100,
        // Enable early exit with multiple conditions
        earlyExitOnError: true,
        errorRateThreshold: 0.05, // Exit if 5% of requests fail
        errorCountThreshold: 50, // Exit after 50 total errors
        errorStatusCodes: [500, 503], // Exit on server errors
      },
      requests: [
        { url: 'https://api.example.com/health', method: 'GET' },
        {
          url: 'https://api.example.com/users',
          method: 'POST',
          payload: { name: 'test' },
        },
      ],
    };

    const summary: TestSummary = await runLoadTest(config);

    console.log('Test completed successfully!');
    console.log(`Total requests: ${summary.global.totalRequests}`);
    console.log(`Failed requests: ${summary.global.failedRequests}`);
    console.log(`Average latency: ${summary.global.avgLatencyMs}ms`);

    // Check if test exited early
    if (summary.global.failedRequests > 0) {
      console.warn('⚠️  Test may have exited early due to errors');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

earlyExitTest();
```

### Advanced Early Exit Configuration

For more complex scenarios, you can use different combinations of early exit conditions:

```ts
// Exit on high error rate for performance testing
await runLoadTest({
  $schema:
    'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
  options: {
    workers: 20,
    durationSec: 300,
    rps: 200,
    earlyExitOnError: true,
    errorRateThreshold: 0.01, // Very strict: 1% error rate
  },
  requests: [{ url: 'https://api.example.com/load-test', method: 'GET' }],
});

// Exit on specific error count for reliability testing
await runLoadTest({
  $schema:
    'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
  options: {
    workers: 5,
    durationSec: 600,
    rps: 50,
    earlyExitOnError: true,
    errorCountThreshold: 10, // Stop after 10 errors
  },
  requests: [{ url: 'https://api.example.com/reliability', method: 'GET' }],
});

// Exit on specific status codes for error handling validation
await runLoadTest({
  $schema:
    'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
  options: {
    workers: 15,
    durationSec: 180,
    rps: 150,
    earlyExitOnError: true,
    errorStatusCodes: [429, 503], // Rate limiting or service unavailable
  },
  requests: [{ url: 'https://api.example.com/error-test', method: 'GET' }],
});
```

## 🤝 Contributing

**Current Status**: I'm currently not accepting external contributions to `tressi`.

This project was built during late-night hours as a way to deepen my understanding of Node.js performance and CLI architecture. Keeping it as a solo effort allows me to iterate rapidly, make breaking changes without constraint, and focus narrowly on my own use cases.

That said, I'm grateful for the community's interest and may open it up in the future. For more details, see [CONTRIBUTING.md](./docs/01-home/02-contributing.md).

## 🧭 Stability & Compatibility

- 📚 **Documentation**  
  The documentation will always reflect the latest release. All documented features are expected to work as described.

- 🚀 **Release Quality**  
  Each release is intended to be stable and functional. If issues arise, they will be addressed based on my availability and priorities.

- 🔁 **Backwards Compatibility**  
  Future enhancements will strive to maintain backwards compatibility. If breaking changes become necessary, they will be clearly documented with upgrade guidance.

- 🧪 **Programmatic Usage Warning**  
  While CLI usage is the recommended and stable interface, programmatic usage (via importing internal modules) is **not guaranteed to be stable** at this time. APIs may change without notice until the internal structure matures.
