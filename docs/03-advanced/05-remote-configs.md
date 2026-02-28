# Centralizing Remote Configurations

Managing test definitions across distributed teams and automated environments often leads to configuration drift and security challenges. Remote configurations allow you to centralize test logic, ensuring that all execution environments pull from a single source of truth while maintaining secure access to sensitive definitions.

This document covers:

- **Remote Configuration**: Executing tests directly from HTTPS endpoints.
- **Secure Access**: Using presigned URLs and SAS tokens to protect private configurations.
- **Schema Validation**: Ensuring remote definitions remain compatible with the CLI runtime.

### Remote Configuration

The CLI loads configuration files from HTTPS endpoints. This enables teams to maintain a single source of truth for performance tests without manual file distribution.

To execute a test using a remote configuration, provide the URL as the primary argument to the `run` command:

```bash
tressi run "https://config.internal.company.com/performance/api.json"
```

The CLI performs an HTTP GET request to retrieve the JSON payload. The response must be a valid JSON object conforming to the Tressi configuration schema.

### Secure Access

For configurations stored in private cloud storage (e.g., AWS S3, Google Cloud Storage, or Azure Blob Storage), use presigned URLs or Shared Access Signature (SAS) tokens to grant temporary, secure access.

**Example using a presigned URL:**

```bash
tressi run "https://s3.amazonaws.com/my-bucket/test.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
```

### Schema Validation

The CLI validates remote configurations against the internal Zod schema before execution. This ensures the runtime environment is compatible with the provided configuration.

If validation fails, the CLI terminates with a report identifying the incompatible fields.

### Operational Workflows

Remote configurations enable several operational workflows:

- **Automated Pipelines**: Pipelines pull validated test definitions from a central repository.
- **Environment Management**: Maintain distinct configuration URLs for staging, canary, and production environments.
- **Team Collaboration**: Share test scenarios via URL instead of local files.

### Next Steps

Review the [Reference](../04-reference/index.md) section for detailed CLI and Schema documentation.
