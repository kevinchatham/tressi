# CLI Reference

The Tressi CLI is the primary way to interact with the application.

## Commands

### `tressi run <config>`

Runs a load test based on the provided configuration file.

**Arguments:**

- `<config>`: Path or URL to JSON configuration file.

**Options:**

- `-e, --export <path>`: Export test results to specified path (supports `.json`, `.xlsx`, `.md`).
- `-s, --silent`: Run in silent mode without TUI or progress output.

### `tressi serve`

Starts the Tressi Hono server, which provides the Web UI and API.

**Options:**

- `-p, --port <port>`: Server port. Defaults to `3108`.

### `tressi reset`

Completely resets the Tressi database, clearing all test history.

## Examples

```bash
# Run a test with a specific config
tressi run ./my-config.json

# Run a test and export to Excel
tressi run ./my-config.json --export report.xlsx

# Start the server on a custom port
tressi serve --port 8080
```
