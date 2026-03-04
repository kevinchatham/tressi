# Command Line Reference

The Tressi CLI provides a set of commands to execute load tests, manage the local database, and start the web interface. It is designed for both interactive use and integration into automated pipelines.

This document covers:

- **CLI Commands**: Executing tests, starting the server, and managing data.
- **Global Options**: Accessing system information and command assistance.
- **Environment Variables**: Configuring runtime behavior via the shell.

### Global Options

Access system information and command assistance.

**Options:**

- `--version`: Display the current version of the Tressi CLI.
- `--help`: Display help information for the CLI or a specific command.

### Run Load Tests

Execute a load test based on a JSON configuration schema.

- `tressi run <config>`

**Arguments:**

- `<config>`: Path to a local JSON file or a valid HTTPS URL pointing to a remote configuration.

**Options:**

- `--export <path>`: Export test results in all formats (JSON, XLSX, MD) to the specified directory.
- `--silent`: Suppress TUI and progress output. Optimized for automated pipelines and environments.

**Remote Configurations:**

- The CLI performs an HTTP GET request to retrieve the JSON payload.
- The response must be a valid JSON object conforming to the Tressi configuration schema.
- For private configurations, use presigned URLs or SAS tokens to grant access.

**Examples:**

- **Execute Local Test**:
  ```bash
  tressi run ./load-test.config.json
  ```
- **Execute Remote Test with Export**:
  ```bash
  tressi run "https://api.example.com/conf.json" --export ./reports/results
  ```
- **Headless Execution**:
  ```bash
  tressi run ./config.json --silent --export ./reports/results
  ```

### Start Server

Start the Tressi Server to provide access to the web interface.

- `tressi serve`

**Options:**

- `--port <port>`: Specify the network port for the server. Defaults to `3108`.

**Example:**

- **Custom Server Port**:
  ```bash
  tressi serve --port 8080
  ```

### Reset Database

Purge all stored data from the local database.

- `tressi reset`

**Details:**

- This command deletes all local data.
- Requires manual confirmation before execution.

**Example:**

- **Database Purge**:
  ```bash
  tressi reset
  ```

### Environment Variables

Configure CLI and server behavior using environment variables.

- `TRESSI_DB_PATH`: Specify a custom path for the SQLite database. Defaults to `~/.tressi/tressi.db`.

### Next Steps

Review the [Configuration Schema](./02-schema.md) to define request parameters and global runner options for CLI execution.
