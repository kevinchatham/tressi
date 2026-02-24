# Quickstart Guide

Configure, execute, and analyze load tests via the web interface.

### 1. Create Configuration

1.  Navigate to [Configs](/configs/create).
2.  Click **Create** to open the configuration form.
3.  **General Options**: Set the name and test duration.
4.  **Requests Options**: Add target URLs and configure request parameters.
5.  Click **Save** in the header to persist the configuration.
6.  The **Create** button moves to the header after the first configuration is saved.

### 2. Select Configuration

Navigate to the [Dashboard](/dashboard) using one of the following methods:

1.  **Configuration Card**: On the [Configs](/configs) page, expand the target configuration and click **Use**.
2.  **Global Navigation**: Click **Dashboard** in the header, then use the **Select Config** dropdown.

### 3. Execute Test

1.  Click **Start Test**.
2.  The test initializes and appears in the **Test List** table.
3.  Test status transitions to `running` as worker threads spawn.
4.  The **Start Test** button moves to the header after the first execution.

### 4. Monitor Metrics

1.  **Test List**: Review metrics in the table.
2.  **Column Selector**: Toggle visible metrics using the column selector icon.
3.  **Detailed View**: Click a running test to open the **Test Details** page.

### 5. Analyze & Export Results

1.  **Realtime Charts**: Monitor performance over time as data aggregates from worker threads.
2.  **Metric Scoping**: Toggle between **Global** and **Endpoint** views to analyze aggregate performance or individual endpoint behavior.
3.  **Metrics Grid**: Review aggregate performance telemetry and system resource utilization.
4.  **Export**: Click **Export** in the header to download results in **JSON**, **XLSX**, or **Markdown**.

### 6. CLI Execution

Run tests in automated pipelines using the Tressi CLI. Review the [CLI Reference](../04-reference/01-command-line.md) for execution commands and configuration options.

### Next Steps

Review [Core Concepts](../02-core-concepts/index.md) to learn about the fundamentals of Tressi.
