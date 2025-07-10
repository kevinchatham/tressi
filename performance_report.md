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

### **Follow-up Analysis (Current State)**

This analysis reviews the changes made to address the initial performance report. While some progress has been made, the core architectural flaws remain, and one of the "fixes" has introduced a critical data integrity issue.

---

#### **1. Unbounded In-Memory Result Storage (`runner.ts`)**

- **Status:** **Addressed**
- **Observation:** The `runner.ts` file no longer stores every single latency value in an unbounded array. Instead, it now uses an **HDR Histogram** (`this.histogram`) to efficiently aggregate and store latency distributions without retaining individual latency values. Additionally, `this.sampledResults` is capped at 1,000 items, and `this.recentLatenciesForSpinner` and `this.recentRequestTimestamps` are bounded arrays used for specific, short-term purposes.
- **Impact:** This change effectively eliminates the risk of unbounded memory growth due to storing all request results or latency values, making the application suitable for large-scale tests.
- **Code Reference:** `runner.ts:78` (now refers to `this.sampledResults` cap), `runner.ts:100` (for `this.histogram`), `runner.ts:83` (for `this.recentLatenciesForSpinner`), `runner.ts:92` (for `this.recentRequestTimestamps`)

---

#### **2. Inefficient Real-time RPS and Autoscaling Calculations (`runner.ts`)**

- **Status:** **Mostly Addressed**
- **Observation:** The `getCurrentRps` method was significantly improved. It now uses a `recentRequestTimestamps` array that only holds timestamps from the last second, avoiding the expensive filtering of the entire result set.
- **Impact:** This has made real-time RPS calculations much more efficient and scalable. While a circular buffer would be a more memory-efficient data structure, the current implementation is a major improvement and no longer a critical bottleneck.
- **Code Reference:** `runner.ts:170-176`

---

#### **3. Expensive Live Statistical Calculations (`stats.ts`, `ui.ts`)**

- **Status:** **Partially Addressed**
- **Observation:** The percentile calculation was improved by replacing the full `sort` with a more performant `quickselect` algorithm. However, the Terminal UI (`ui.ts`) still calls `runner.getLatencies()` every 500ms, retrieving the **entire unbounded `latencies` array**. The `getLatencyDistribution` function then iterates over this massive array to generate the UI chart.
- **Impact:** The high CPU usage problem in the UI loop remains. As the test progresses, the UI will become slower and less responsive, consuming significant CPU resources.
- **Code References:** `ui.ts:150`, `ui.ts:157`, `distribution.ts:23`

---

#### **4. High Post-Test Processing Overhead (`summarizer.ts`, `exporter.ts`)**

- **Status:** **Addressed, but Functionally Incorrect**
- **Observation:** The post-test processing overhead has been eliminated. The `generateSummary` and `exportDataFiles` functions now operate only on the `sampledResults` array (max 1,000 items).
- **Impact:** This change, while performant, introduces a **critical data integrity bug**. The final summary, reports, and exported data are now based on a tiny, statistically insignificant sample of the total test run. This makes the final results inaccurate and misleading for any non-trivial test. The fix has prioritized performance over correctness, rendering the primary output of the tool unreliable.
- **Code References:** `summarizer.ts:60`, `index.ts:515`

---

### **Updated Conclusion**

The application's core architecture is still not suited for scalable load testing. The primary issue of unbounded in-memory data storage persists (shifted from `RequestResult[]` to `number[]`), and the UI remains a performance concern. The attempt to fix the post-test processing has severely compromised the tool's correctness.

The original recommendation to adopt a **"streaming aggregation"** model is more critical now than ever. This is the only path to achieving both performance and accuracy.

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
