# Configuration Schema

Tressi uses a JSON schema to validate your configuration files.

## Schema Location

The schema is available at `projects/tressi-cli/tressi.schema.json`.

## Top-Level Properties

- `requests`: (Required) An array of request objects.
- `options`: (Optional) Global test options.

## Request Object

| Property | Type   | Description                    |
| -------- | ------ | ------------------------------ |
| `url`    | string | The target URL.                |
| `method` | string | HTTP method (GET, POST, etc.). |
| `rps`    | number | Target requests per second.    |

## Options Object

| Property      | Type   | Description               |
| ------------- | ------ | ------------------------- |
| `durationSec` | number | Total test duration.      |
| `threads`     | number | Number of worker threads. |
