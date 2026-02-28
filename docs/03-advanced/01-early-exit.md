# Automated Test Termination

Early Exit monitors test execution and stops individual endpoints or the entire test when performance degrades beyond acceptable limits. This prevents system wide outages and ensures metrics remain representative of healthy system behavior.

This document covers:

- **Configuring Error Thresholds**: Defining error rate limits for different API types.
- **Defining Exit Status Codes**: Stopping execution on critical failures by mapping terminal status codes.
- **Adjusting Evaluation Intervals**: Configuring monitoring windows to balance responsiveness and stability.

### Configuration Precedence

Early Exit can be configured globally or per endpoint. Request level configurations take precedence over global settings.

- **Global Configuration**: Defined in `options.workerEarlyExit`.
- **Endpoint Configuration**: Defined in `requests[].earlyExit`.

### Configuring Error Thresholds

The `errorRateThreshold` (0.0 to 1.0) defines the percentage of failed requests allowed before an endpoint is stopped.

- **Critical APIs**: Set a low threshold (e.g., `0.01` for 1%) for sensitive endpoints where any failure indicates a major issue.
- **Resilient APIs**: Use a higher threshold (e.g., `0.10` for 10%) for services that typically experience transient errors under load.

### Defining Exit Status Codes

Immediate termination triggers when specific HTTP status codes are encountered. This is used for catching "circuit breaker" responses or rate limiting.

Commonly used codes:

- `401`: Unauthenticated
- `429`: Too Many Requests
- `503`: Service Unavailable
- `504`: Gateway Timeout

### Adjusting Evaluation Intervals

The `monitoringWindowMs` determines how often thresholds are evaluated.

- **Short Windows (e.g., 1000ms)**: Provide rapid response to failures but may be susceptible to transient network errors.
- **Long Windows (e.g., 10000ms)**: Offer greater stability and prevent premature termination from temporary spikes.

> The default value is `1000ms`

### Next Steps

Review [Pipeline Integration](./03-pipeline-integration.md) to learn how to integrate Tressi into deployment workflows.
