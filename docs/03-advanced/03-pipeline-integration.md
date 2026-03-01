# Pipeline Integration

Automate performance regression testing by integrating Tressi into deployment pipelines. This ensures that every code change is validated against performance requirements before reaching production.

This document covers:

- **Headless Execution**: Running the CLI in non-interactive environments.
- **POSIX Exit Code Logic**: Understanding how Tressi signals test outcomes to the pipeline.
- **Artifact Management**: Automating the generation and storage of test reports.

### Headless Execution

Run the Tressi CLI in environments without a TUI using the `--silent` flag.

```bash
tressi run ./load-test.config.json --silent
```

- **Flag**: `-s` or `--silent`
- **Effect**: Suppresses the Terminal User Interface (TUI), realtime progress updates, and the final summary printout.
- **Outcome**: Reduces log noise and prevents issues in environments that do not support interactive terminal features.

### Exit Code Logic

Tressi uses standard POSIX exit codes to signal the outcome of a test run to the calling process.

- **Exit Code 0**: Indicates a successful test run where all requests were processed and no thresholds were exceeded.
- **Exit Code 1**: Indicates a failure condition. This occurs when:
  - The configuration file is invalid or missing.
  - A runtime error occurs (e.g., worker thread failure).
  - **Early Exit**: Configured error thresholds (rate, count, or status codes) are exceeded, causing the test to terminate prematurely.

### Artifact Management

Automate the generation and storage of test results for historical analysis or pull request feedback using the `--export` flag.

```bash
tressi run ./load-test.config.json --silent --export ./artifacts/perf-results
```

- **Flag**: `-e <path>` or `--export <path>`
- **Behavior**: Creates a timestamped directory containing multiple report formats.
- **Generated Files**:
  - `summary.json`: Machine readable metrics for automated parsing or custom dashboards.
  - `results.xlsx`: Tabular data for manual review and spreadsheet based analysis.
  - `report.md`: A concise Markdown summary suitable for posting as a comment on pull requests.

### GitHub Actions Integration

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-node@v6
    with:
      node-version: '24'
  - run: npm install -g tressi
  - name: Run Load Test
    run: tressi run ./perf/config.json --silent --export ./reports
  - name: Upload Results
    uses: actions/upload-artifact@v7
    with:
      name: performance-reports
      path: ./reports/*/
```

### Next Steps

Review [Performance Tuning](./04-performance-tuning.md) to optimize the Tressi runner for high scale tests.
