# Quickstart Guide

Get up and running with Tressi by configuring, executing, and analyzing your first load test through the interactive web interface.

This document covers:

- **Configuration Management**: Creating and selecting test configurations via the web interface.
- **Test Execution**: Initializing and running tests with realtime status monitoring.
- **Analysis & Export**: Monitoring performance metrics and exporting results in multiple formats.

### Create Configuration

1.  Navigate to [Configs](/configs/create).
2.  Click **Create** to open the configuration form.
3.  **General Options**: Set the name and test duration.
4.  **Requests Options**: Add target URLs and configure request parameters.
5.  Click **Save** in the header to persist the configuration.
6.  The **Create** button moves to the header after the first configuration is saved.

### Select Configuration

Navigate to the [Dashboard](/dashboard) using one of the following methods:

1.  **Configuration Card**: On the [Configs](/configs) page, expand the target configuration and click **Use**.
2.  **Global Navigation**: Click **Dashboard** in the header, then use the **Select Config** dropdown.

### Execute Test

1.  Click **Start Test**.
2.  The test initializes and appears in the **Test List** table.
3.  Test status transitions to `running` as worker threads spawn.
4.  The **Start Test** button moves to the header after the first execution.

### Monitor Metrics

1.  **Test List**: Review metrics in the table.
2.  **Column Selector**: Toggle visible metrics using the column selector icon.
3.  **Detailed View**: Click a running test to open the **Test Details** page.

### Analyze & Export Results

1.  **Realtime Charts**: Monitor performance over time as data aggregates from worker threads.
2.  **Metric Scoping**: Toggle between **Global** and **Endpoint** views to analyze aggregate performance or individual endpoint behavior.
3.  **Metrics Grid**: Review aggregate performance telemetry and system resource utilization.
4.  **Export**: Click **Export** in the header to download results in **JSON**, **XLSX**, or **Markdown**.

### Next Steps

Review [Core Concepts](../02-core-concepts/index.md) to learn about the fundamentals of Tressi.
