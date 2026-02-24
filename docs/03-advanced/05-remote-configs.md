# Remote Configurations & Security

Centralize and share test definitions across teams using remote URLs and secure access methods.

### Remote Configuration Capabilities

This document covers:

- **Load Remote Configurations**: Executing tests directly from remote URLs.
- **Secure Remote Access**: Using Signed URLs or SAS tokens to protect sensitive configurations.
- **Validate Remote Schemas**: Ensuring remote configurations remain compatible with the installed CLI version.

### Load Remote Configurations

The CLI loads configuration files from HTTP/HTTPS endpoints. This enables teams to maintain a single source of truth for performance tests without manual file distribution.

To execute a test using a remote configuration, provide the URL as the primary argument to the `run` command:

```bash
tressi run https://config.internal.company.com/performance/api-v1.json
```

The CLI performs an HTTP GET request to retrieve the JSON payload. The response must be a valid JSON object conforming to the Tressi configuration schema.

### Secure Remote Access

For configurations stored in private cloud storage (e.g., AWS S3, Google Cloud Storage, or Azure Blob Storage), use presigned URLs or Shared Access Signature (SAS) tokens to grant temporary, secure access.

**Example using a presigned URL:**

```bash
tressi run "https://s3.amazonaws.com/my-bucket/test.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
```

### Validate Remote Schemas

The CLI validates remote configurations against the internal Zod schema before execution. This ensures the runtime environment is compatible with the provided configuration.

Configurations should include the `$schema` field for IDE autocompletion and version tracking:

```json
{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json",
  ...
}
```

If validation fails, the CLI terminates with a report identifying the incompatible fields.

### Operational Workflows

Remote configurations enable several operational workflows:

- **Automated Pipelines**: Pipelines pull validated test definitions from a central repository.
- **Environment Management**: Maintain distinct configuration URLs for staging, canary, and production environments.
- **Team Collaboration**: Share test scenarios via URL instead of local files.

### Next Section

Review the [Reference](../04-reference/index.md) section for detailed CLI and Schema documentation.
