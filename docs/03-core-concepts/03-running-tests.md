# Running Tests

Learn how to execute and manage your load tests.

## Using the CLI

The most common way to run a test is via the CLI:

```bash
tressi run <config-file>
```

### Options

- `--ui`: Start the web dashboard automatically.
- `--port`: Specify a custom port for the dashboard.

## Using the Web UI

1. Start the Tressi server: `tressi serve`
2. Navigate to `http://localhost:3000`
3. Upload or create a configuration.
4. Click **Start Test**.

## Monitoring Progress

During a test, Tressi provides real-time feedback:

- **RPS**: Current requests per second.
- **Latency**: P50, P95, and P99 percentiles.
- **Success Rate**: Percentage of 2xx responses.
