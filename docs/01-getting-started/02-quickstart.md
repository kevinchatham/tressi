# Quickstart Guide

This guide covers the core Tressi workflow for configuring, executing, and analyzing load tests via the web interface.

### 1. Create Configuration

Define test parameters by creating a new configuration.

1.  Navigate to the [Configs](/configs/create) page.
2.  Click the **Create button** to open the configuration form.
    - Center of the page for first time users, or in the header if configurations already exist.
3.  **General Options**: Set the name and test duration. All other settings in this section are optional.
4.  **Requests Options**: Add target URLs and configure request parameters for each endpoint.
5.  Click **Save** in the header to persist the configuration.

### 2. Select Configuration

Navigate to the [Dashboard](/dashboard) page using one of the following methods:

1.  **Configuration Card**: On the [Configs](/configs) page, expand the target configuration and click **Use** button in the _bottom right_. This navigates to the [Dashboard](/dashboard) page with the configuration preselected.
2.  **Global Navigation**: Click the **Dashboard** button in the header, then use the **Select Config** dropdown in the following header.

### 3. Execute Test

1.  Click the **Start Test** button (located in the center of the page for first-time executions, or in the header if test history exists).
2.  The test initializes and appears in the **Test List** table.
3.  Status transitions from `running` as worker threads spawn.
4.  Once a test is active or history exists, the **Start Test** button moves to the header for subsequent executions.

### 4. Monitor Metrics

1.  **Test List**: Overview metrics directly in the table.
2.  **Column Selector**: Use the column selector icon to toggle visible metrics.
3.  **Detailed View**: Click a running test to open the **Test Details** page.

### 5. Analyze & Export Results

The **Test Details** page provides telemetry and statistical breakdowns.

1.  **Realtime Charts**: Monitor performance over time as data aggregates from worker threads.
2.  **Metric Scoping**: Toggle between **Global** and **Endpoint** views to analyze aggregate performance or individual endpoint behavior.
3.  **Metrics Grid**: Review aggregate performance telemetry and system resource utilization.
4.  **Export**: Click the **Export** button in the header to download results in **JSON**, **XLSX**, or **Markdown**.

### 6. Export & Import

- **Share Results**: Exported Markdown or XLSX files can be attached to pull requests or performance reports.
- **Share Configurations**: Export configurations as JSON files from the **Configs** page for team distribution.

### 7. CLI Execution

The Tressi CLI is designed for automated environments and CI/CD pipelines. You can execute load tests by providing a local configuration file or a remote URL. Results are exported to a timestamped directory containing JSON, XLSX, and Markdown reports simultaneously:

```bash
# Run with local config and export results
tressi run ./tressi-config.json --export my-report

# Run with remote config (e.g., via signed URL)
tressi run "https://storage.provider.com/configs/test.json?sig=..."
```

> ⚠️ WARNING: Remote configurations may contain sensitive information like access tokens. Ensure remote URLs are secured (e.g., using Blob Storage with SAS tokens or signed URLs) and avoid using public repositories for configurations containing credentials.

### Next Steps

Review the [Core Concepts](../02-core-concepts/index.md) to continue learning about the fundamentals of Tressi.
