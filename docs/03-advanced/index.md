# Advanced Usage

Take your load testing to the next level.

## Early Exit Criteria

Stop tests automatically if performance degrades beyond a certain point.

```json
{
  "earlyExit": {
    "errorRateThreshold": 0.05,
    "latencyP99ThresholdMs": 1000
  }
}
```

## CI/CD Integration

Run Tressi as part of your GitHub Actions or GitLab CI pipelines.

## Custom Exporters

Export your results to JSON, XLSX, or Markdown for custom reporting.
