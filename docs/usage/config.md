# Configuration Guide

Tressi uses a JSON configuration file to define load tests.

## Global Options

- `durationSec`: Total duration of the test in seconds.
- `rampUpDurationSec`: Time in seconds to ramp up to the target RPS.
- `threads`: Number of worker threads to use.
- `headers`: Global headers sent with every request.

## Request Configuration

Each request in the `requests` array can have:

- `url`: The target URL.
- `method`: HTTP method (GET, POST, etc.).
- `rps`: Target requests per second for this endpoint.
- `payload`: JSON payload for POST/PUT requests.
- `headers`: Endpoint-specific headers.
- `earlyExit`: Configuration for stopping the test early if error thresholds are met.

## Example Config

```json
{
  "$schema": "./tressi.schema.json",
  "requests": [
    {
      "url": "https://api.example.com/v1/users",
      "method": "GET",
      "rps": 50
    }
  ],
  "options": {
    "durationSec": 60,
    "rampUpDurationSec": 10,
    "threads": 4
  }
}
```
