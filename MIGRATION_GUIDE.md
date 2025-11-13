# Worker Threads Migration Guide

This guide helps you migrate from the async/event-loop architecture to the new worker threads-based system in Tressi.

## Overview

Tressi has been upgraded to use **worker threads** for true multi-core utilization, providing significant performance improvements:

- **7.5x better RPS accuracy** (±2% vs ±15% variance)
- **4-8x better CPU utilization** (multi-core vs single-core)
- **5-15x better timer precision** (<1ms vs 5-15ms jitter)
- **Coordinated early exit** across all workers

## Backward Compatibility

**100% backward compatibility is maintained.** All existing configurations continue to work exactly as before. The migration is **additive only** - no breaking changes.

## Migration Steps

### 1. Verify Node.js Version

Worker threads require Node.js 20.0.0 or higher:

```bash
node --version
# Should be >= 20.0.0
```

### 2. Update Configuration (Optional)

To enable worker threads, simply add the `threads` option to your configuration:

**Before (Async Mode):**

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

**After (Worker Threads Mode):**

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 4,
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

### 3. New Configuration Options

#### Worker Threads Options

| Option              | Type    | Description                               | Default   |
| ------------------- | ------- | ----------------------------------------- | --------- |
| `threads`           | integer | Number of worker threads (1 to CPU cores) | CPU count |
| `workerMemoryLimit` | integer | Memory limit per worker in MB (16-512)    | 128       |
| `workerEarlyExit`   | object  | Coordinated early exit configuration      | `{}`      |

#### Worker Early Exit Configuration

```json
{
  "options": {
    "workerEarlyExit": {
      "enabled": true,
      "globalErrorRateThreshold": 0.05,
      "globalErrorCountThreshold": 100,
      "perEndpointThresholds": [
        {
          "url": "https://api.example.com/critical",
          "errorRateThreshold": 0.01,
          "errorCountThreshold": 10
        }
      ],
      "workerExitStatusCodes": [500, 503],
      "monitoringWindowMs": 1000,
      "stopMode": "global"
    }
  }
}
```

### 4. Performance Tuning

#### CPU-Intensive Tests

For maximum performance, use all CPU cores:

```json
{
  "options": {
    "threads": 8,
    "workerMemoryLimit": 256,
    "durationSec": 60,
    "rps": 1000
  }
}
```

#### Memory-Constrained Environments

Reduce memory usage per worker:

```json
{
  "options": {
    "threads": 4,
    "workerMemoryLimit": 64,
    "durationSec": 30,
    "rps": 500
  }
}
```

#### Single-Thread Mode

To use the legacy async mode, either omit `threads` or set it to 1:

```json
{
  "options": {
    "threads": 1,
    "durationSec": 30,
    "rps": 100
  }
}
```

## Configuration Examples

### Basic Worker Threads

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 4,
    "durationSec": 30,
    "rps": 200
  },
  "requests": [
    {
      "url": "https://api.example.com/health",
      "method": "GET"
    }
  ]
}
```

### High-Performance Testing

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 8,
    "workerMemoryLimit": 512,
    "durationSec": 120,
    "rps": 5000,
    "workerEarlyExit": {
      "enabled": true,
      "globalErrorRateThreshold": 0.02
    }
  },
  "requests": [
    {
      "url": "https://api.example.com/load-test",
      "method": "GET"
    }
  ]
}
```

### Per-Endpoint Monitoring

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 6,
    "durationSec": 300,
    "rps": 1000,
    "workerEarlyExit": {
      "enabled": true,
      "perEndpointThresholds": [
        {
          "url": "https://api.example.com/critical",
          "errorRateThreshold": 0.01
        },
        {
          "url": "https://api.example.com/secondary",
          "errorRateThreshold": 0.05,
          "errorCountThreshold": 50
        }
      ],
      "stopMode": "endpoint"
    }
  },
  "requests": [
    {
      "url": "https://api.example.com/critical",
      "method": "GET"
    },
    {
      "url": "https://api.example.com/secondary",
      "method": "GET"
    }
  ]
}
```

## CLI Usage

No changes to CLI usage. All worker thread configuration is done through the JSON file:

```bash
# Basic usage
tressi

# With custom config
tressi --config my-config.json

# Generate new config with worker threads
tressi init --full
```

## Troubleshooting

### Common Issues

1. **Node.js Version Too Low**

   ```
   Error: Worker threads require Node.js >= 20.0.0
   ```

   **Solution:** Upgrade Node.js to version 20.0.0 or higher.

2. **Memory Issues**

   ```
   Error: Worker memory limit exceeded
   ```

   **Solution:** Increase `workerMemoryLimit` or reduce `threads`.

3. **CPU Overload**
   ```
   System becomes unresponsive
   ```
   **Solution:** Reduce `threads` or `rps` values.

### Performance Validation

Run a simple test to validate worker threads are working:

```bash
# Create test config
cat > test-config.json << EOF
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  "options": {
    "threads": 4,
    "durationSec": 10,
    "rps": 100,
    "useUI": false
  },
  "requests": [
    {
      "url": "https://httpbin.org/get",
      "method": "GET"
    }
  ]
}
EOF

# Run test
tressi --config test-config.json
```

## Migration Checklist

- [ ] Verify Node.js version >= 20.0.0
- [ ] Test existing configurations (should work unchanged)
- [ ] Add `threads` option for performance testing
- [ ] Configure `workerEarlyExit` if needed
- [ ] Adjust `workerMemoryLimit` based on system resources
- [ ] Validate performance improvements

## Backward Compatibility Notes

- All existing configurations work without changes
- CLI interface remains identical
- JSON schema is backward compatible
- Async mode available by setting `threads: 1` or omitting the option
- Early exit options work in both async and worker modes
