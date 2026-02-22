> UNFINISHED

# CI/CD Integration

Automate performance regression testing by integrating Tressi into your deployment pipelines.

### Overview

This document will cover:

- **Headless Execution**: Running the CLI in environments without a TTY using the `--silent` flag.
- **Exit Code Logic**: Understanding how Tressi signals success or failure to the pipeline (e.g., non-zero exit codes on early exit).
- **Artifact Management**: Automating the export of JSON, XLSX, and Markdown reports for pull request comments or performance history.

### Automation Benefits

By making performance testing a standard part of your CI/CD pipeline, you can catch performance regressions before they reach production and maintain a historical record of your API's performance profile.

### Next Steps

Review [Performance Tuning](./04-performance-tuning.md) to learn how to optimize the Tressi runner for high-scale tests.
