### **Performance Analysis Report for Tressi**

#### **1. Executive Summary**

The Tressi application is well-structured, but its current design contains significant architectural choices that will negatively impact performance, particularly under high-volume or long-duration load tests. The core issues stem from storing every request result in memory and repeatedly processing this growing dataset during the test run. These bottlenecks will lead to high memory consumption and increasing CPU usage as a test progresses, limiting the application's scalability.

---

#### **2. Critical Performance Bottlenecks**

These issues are likely to cause significant performance degradation or crashes during load tests.

- **Unbounded In-Memory Result Storage (`runner.ts`)**
  - **Observation:** The `Runner` class stores every single `RequestResult` object in the `this.results` array for the entire duration of the test. For a test running at 1,000 RPS for 5 minutes, this array would hold 300,000 objects.
  - **Impact:** This leads to massive and continuously growing memory consumption, which can easily exhaust the available heap space and crash the Node.js process. It makes the application unsuitable for large-scale tests.
  - **Code Reference:** `runner.ts:21`, `runner.ts:60`

- **Inefficient Real-time RPS and Autoscaling Calculations (`runner.ts`)**
  - **Observation:** The `getCurrentRps()` method, which is fundamental to the UI, logging, and autoscaling logic, calculates the requests per second by filtering the _entire_ `this.results` array. The autoscaler uses this function every 2 seconds.
  - **Impact:** The complexity of this calculation is `O(N)`, where `N` is the total number of requests made so far. As the test runs, `N` grows, and this operation becomes progressively slower. This continuous, expensive filtering puts unnecessary load on the CPU and causes the application's internal logic to slow down over time.
  - **Code Reference:** `runner.ts:150-155`

---

#### **3. Secondary Performance Concerns**

These issues will degrade performance and user experience, especially with the data generated from large tests.

- **Expensive Live Statistical Calculations (`stats.ts`, `index.ts`, `ui.ts`)**
  - **Observation:** Percentile calculations (`p95`, `p99`) are performed by sorting the entire list of collected latencies. This `sort` operation (O(N log N)) is executed every second in the `--no-ui` mode and every 500ms for the latency distribution chart in the TUI (`getLatencyDistribution`).
  - **Impact:** For a test with millions of requests, sorting a large array of numbers this frequently is computationally expensive and inefficient. It contributes to high CPU usage, especially in the UI and logging loops.
  - **Code Reference:** `stats.ts:28`, `index.ts:445`, `ui.ts:150`

- **High Post-Test Processing Overhead (`summarizer.ts`, `exporter.ts`)**
  - **Observation:** After the test completes, the `generateSummary`, `printSummary`, and `exportDataFiles` functions perform multiple passes over the complete, and potentially huge, `results` array to aggregate data, create summaries, and generate reports.
  - **Impact:** This can cause a long delay and high memory usage at the end of a test while the results are processed, providing a poor user experience. For very large result sets, this processing step could fail.
  - **Code Reference:** `summarizer.ts:59`, `exporter.ts:16`, `exporter.ts:31`

---

#### **4. Recommendations for Improvement**

To address these issues, I recommend shifting from a "collect-then-process" model to a "streaming aggregation" model.

1.  **Eliminate Unbounded Result Storage:**
    - Instead of storing every `RequestResult`, update summary statistics in real-time as each request finishes. The `Runner` should maintain aggregated data structures, such as a latency histogram (e.g., an HDR Histogram) and counters for status codes. Only a small, fixed-size sample of failed requests or unique responses needs to be stored in full for debugging.

2.  **Optimize Real-time Calculations:**
    - To calculate `currentRps` efficiently, use a data structure like a circular buffer or a queue that only stores timestamps from the last few seconds. This makes the calculation independent of the total test duration (`O(1)` complexity) and eliminates the expensive filtering of the main results array.

3.  **Use Streaming-Based Statistics:**
    - Replace the `percentile` calculation with a streaming percentile algorithm (e.g., T-Digest or by using an HDR Histogram library). These algorithms can calculate quantiles with high accuracy using a fixed, small amount of memory, avoiding the need to store and sort the entire latency dataset.

4.  **Streamline Post-Test Processing:**
    - By implementing the recommendations above, all the necessary data for the final summary will already be aggregated. The post-test processing step would then become near-instantaneous, as it would only involve reading from the final aggregated data structures, not processing raw results.
