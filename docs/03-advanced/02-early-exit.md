# Automated Test Termination

Protect target infrastructure and accelerate feedback loops by configuring test termination.

### Early Exit Overview

Early Exit monitors test execution and stops individual endpoints or the entire test when performance degrades beyond acceptable limits. This prevents system wide outages and ensures metrics remain representative of healthy system behavior.

This document covers:

- **Configuring Error Thresholds**: Configuring Error Rate Threshold for different API types.
- **Defining Exit Status Codes**: Blacklisting Status Codes to stop tests on critical failures.
- **Adjusting Evaluation Intervals**: Adjusting Error Monitoring Window to balance responsiveness and stability.

### Configuration Precedence

Early Exit can be configured globally or per endpoint. Request level configurations always override global settings.

- **Global**: Defined in `options.workerEarlyExit`.
- **Per endpoint**: Defined in `requests[].earlyExit`.

### Configuring Error Thresholds

The `errorRateThreshold` (0.0 to 1.0) defines the percentage of failed requests allowed before an endpoint is stopped.

- **Critical APIs**: Set a low threshold (e.g., `0.01` for 1%) for sensitive endpoints where any failure indicates a major issue.
- **Resilient APIs**: Use a higher threshold (e.g., `0.10` for 10%) for services that typically experience transient errors under load.

```json
{
  "earlyExit": {
    "enabled": true,
    "errorRateThreshold": 0.05,
    "monitoringWindowMs": 5000
  }
}
```

### Defining Exit Status Codes

The `exitStatusCodes` array allows immediate termination when specific HTTP status codes are encountered. This is useful for catching "circuit breaker" responses or rate limiting.

Commonly used codes:

- `401`: Unauthenticated (invalid authorization header)
- `429`: Too Many Requests (indicates rate limiting).
- `503`: Service Unavailable (indicates system saturation).
- `504`: Gateway Timeout (indicates upstream failure).

```json
{
  "earlyExit": {
    "enabled": true,
    "exitStatusCodes": [429, 503, 504],
    "monitoringWindowMs": 1000
  }
}
```

### Adjusting Evaluation Intervals

The Monitoring Window parameter determines how often the `EarlyExitCoordinator` evaluates thresholds.

- **Short Windows (e.g., 1000ms)**: Provide rapid response to failures but may be susceptible to transient network errors.
- **Long Windows (e.g., 10000ms)**: Offer greater stability and prevent premature termination from temporary spikes.

The default value is `1000ms`.

### Implementation Details

The `EarlyExitCoordinator` runs a background interval based on the `monitoringWindowMs`. It aggregates metrics across all worker threads to calculate the current error rate and check for blacklisted status codes. When a violation is detected, the coordinator marks the specific endpoint as `STOPPED` in shared memory, and workers immediately cease sending requests to that URL.

### Next Steps

Review [Automated Pipelines](./03-cicd-integration.md) to learn how to automate performance testing with early exit safety nets.
