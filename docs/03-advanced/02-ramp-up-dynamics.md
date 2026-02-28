# Configuring Load Progression

Sudden bursts of high volume traffic can cause "thundering herd" effects that may not represent real world usage patterns. Ramp up allows you to increase load, giving target systems time to scale resources, warm up caches, and stabilize connection pools before reaching peak intensity.

This document covers:

- **Ramp Up Dynamics**: Understanding the hierarchy between global and endpoint durations and the constraints that ensure statistical integrity.

### Ensuring Statistical Integrity

To maintain statistical integrity, Tressi enforces specific constraints on ramp up:

- **The 25% Rule**: Ramp up duration cannot exceed 25% of the total test duration. This ensures at least 75% of the test runs at the target intensity (the "Constant Load" window).
- **Minimum RPS Requirement**: When global ramp up is enabled, all endpoints must have a target RPS of at least 5 to ensure linear interpolation.
- **Statistical Significance**: By ensuring a majority of the test runs at peak load, Tressi provides metrics that aren't heavily skewed by the initialization phase.

### Global vs Endpoint Ramp Up

Tressi provides granular control over load progression:

- **Hierarchy**: Per endpoint ramp up duration takes precedence. If an endpoint defines a positive ramp up, it overrides the global setting for that specific request.
- **Default Behavior**: If an endpoint's ramp up is set to zero, it inherits the global ramp up settings defined in the test options.
- **Independent Scaling**: Each endpoint manages its own linear progression. This allows for complex scenarios where some services require longer warm up periods than others.

### Next Steps

Review [Early Exit](./01-early-exit.md) to learn how to protect your infrastructure during load tests.
