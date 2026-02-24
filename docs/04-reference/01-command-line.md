# CLI Reference

### Run Load Tests

Execute a load test based on a JSON configuration schema.

`tressi run <config>`

**Arguments:**

- `<config>`: Path to a local JSON file or a valid URL pointing to a remote configuration.

**Options:**

- `-e --export <path>`: Generate shareable reports to a specified directory.
- `-s --silent`: Suppress TUI and progress output. Optimized for automated pipelines and environments.

### Start Server

Start the Tressi Server to provide access to the Web UI.

`tressi serve`

**Options:**

- `-p, --port <port>`: Specify the network port for the server. Defaults to `3108`

> `3108 `represents the speed of light, 3x10^8 m/s.

### Reset Database

Purge all stored data from the local database.

`tressi reset`

**Details:**

- This command deletes all local data.
- Requires manual confirmation before execution.

### CLI Examples

#### Execute Local Test

```bash
tressi run ./load-test.config.json
```

#### Execute Remote Test with Export

```bash
tressi run https://api.example.com/configs/perf.json --export ./reports/results
```

#### Headless Execution

```bash
tressi run ./config.json --silent --export ./reports/results
```

#### Custom Server Port

```bash
tressi serve --port 8080
```

#### Database Purge

```bash
tressi reset
```

### Next Steps

Review the [Configuration Schema](./02-schema.md) to define request parameters and global runner options for CLI execution.
