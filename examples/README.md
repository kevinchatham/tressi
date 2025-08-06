# Tressi Configuration Examples

This directory contains practical JSON configuration examples for various load testing scenarios. Each example is ready to use and demonstrates different features of tressi.

## Quick Start

1. **Choose an example** that matches your testing scenario
2. **Copy and customize** the configuration file
3. **Run the test** with: `npx tressi --config your-config.json`

## Available Examples

### [basic-load-test.json](./basic-load-test.json)

**Purpose**: Simple load test with fixed workers and target RPS
**Key Features**:

- 10 concurrent workers
- 30-second duration
- 200 RPS target
- Basic GET and POST requests

### [autoscaling-test.json](./autoscaling-test.json)

**Purpose**: Dynamic worker scaling to meet target RPS
**Key Features**:

- Autoscaling enabled (up to 50 workers)
- 1000 RPS target
- 60-second duration
- 15-second ramp-up time
- Multiple API endpoints

### [error-handling-test.json](./error-handling-test.json)

**Purpose**: Test with automatic early exit on errors
**Key Features**:

- Early exit on 5% error rate
- Early exit after 50 errors
- Monitors for 500, 502, 503, 504 status codes
- 90-second maximum duration

### [export-test.json](./export-test.json)

**Purpose**: Headless test with comprehensive result export
**Key Features**:

- No UI (headless mode)
- Results exported to `load-test-results` directory
- Multiple API endpoints

### [comprehensive-test.json](./comprehensive-test.json)

**Purpose**: Complete test showcasing all tressi features
**Key Features**:

- Autoscaling with 100 max workers
- 2000 RPS target
- 120-second duration
- All error handling features
- Export enabled

## Customization Guide

### Basic Structure

All configurations follow this structure:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "name": "Your Test Name",
  "description": "Brief description of what this test does",
  "workers": 10,
  "duration": 30,
  "rps": 100,
  "headers": {
    "Content-Type": "application/json"
  },
  "requests": [
    {
      "url": "https://your-api.com/endpoint",
      "method": "GET"
    }
  ]
}
```

### Common Parameters

| Parameter             | Type    | Description                                 | Example          |
| --------------------- | ------- | ------------------------------------------- | ---------------- |
| `workers`             | number  | Number of concurrent workers                | `10`             |
| `duration`            | number  | Test duration in seconds                    | `60`             |
| `rps`                 | number  | Target requests per second                  | `200`            |
| `autoscale`           | boolean | Enable dynamic worker scaling               | `true`           |
| `rampUpTime`          | number  | Time to reach target RPS                    | `15`             |
| `noUi`                | boolean | Disable interactive UI                      | `true`           |
| `export`              | string  | Export results directory                    | `"test-results"` |
| `earlyExitOnError`    | boolean | Enable early exit on errors                 | `true`           |
| `errorRateThreshold`  | number  | Exit when error rate exceeds this (0.0-1.0) | `0.05`           |
| `errorCountThreshold` | number  | Exit after this many errors                 | `50`             |
| `errorStatusCodes`    | array   | Exit on these status codes                  | `[500, 503]`     |

### Request Configuration

Each request in the `requests` array can have:

| Property  | Type         | Description                   | Required             |
| --------- | ------------ | ----------------------------- | -------------------- |
| `url`     | string       | Full URL to request           | Yes                  |
| `method`  | string       | HTTP method (GET, POST, etc.) | No (defaults to GET) |
| `payload` | object/array | Request body data             | No                   |
| `headers` | object       | Request-specific headers      | No                   |

### Environment Variables

You can use environment variables in your configurations:

```json
{
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

## Running Examples

### Local Development

```bash
# Run basic test
npm run test:basic

# Run autoscaling test
npm run test:autoscale

# Run CI test (headless with export)
npm run test:ci
```

### Direct Usage

```bash
# Run any example directly
npx tressi --config examples/basic-load-test.json

# Run with custom output directory
npx tressi --config examples/export-test.json --export my-custom-results

# Run without UI
npx tressi --config examples/comprehensive-test.json --no-ui
```

## Migration from CLI

If you're migrating from CLI commands to JSON configuration, see [migration-examples.md](./migration-examples.md) for detailed before/after comparisons.

## Best Practices

1. **Always include the $schema** for IDE autocompletion and validation
2. **Use descriptive names** for your test configurations
3. **Set appropriate timeouts** based on your API response times
4. **Start small** and scale up gradually
5. **Monitor error rates** and set early exit thresholds
6. **Export results** for detailed analysis
7. **Use version control** for your configuration files

## Troubleshooting

### Common Issues

1. **"Config file not found"**: Ensure the path is correct and file exists
2. **"Invalid JSON"**: Check for syntax errors in your configuration
3. **"Schema validation failed"**: Ensure all required fields are present
4. **"Connection refused"**: Verify your API endpoints are accessible

### Validation

You can validate your configuration using:

```bash
# Check if config is valid JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('your-config.json')))"

# Test with schema validation
npx tressi --config your-config.json --dry-run
```
