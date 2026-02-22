> UNFINISHED

# Early Exit Strategies

Protect your target infrastructure and get faster feedback by configuring intelligent test termination.

### Overview

This document will cover:

- **Threshold Tuning**: How to determine appropriate `errorRateThreshold` values for different API types.
- **Status Code Blacklisting**: Using `exitStatusCodes` to stop tests immediately on critical failures (e.g., 503 Service Unavailable or 429 Too Many Requests).
- **Monitoring Windows**: Understanding how the `monitoringWindowMs` prevents premature termination from transient network blips.

### Why use Early Exit?

Running aggressive load tests can sometimes overwhelm target systems. Early Exit acts as a safety circuit breaker, stopping the test before it causes a system-wide outage or pollutes your metrics with thousands of identical error responses.

### Next Steps

Review [CI/CD Integration](./03-cicd-integration.md) to learn how to automate your performance testing.
