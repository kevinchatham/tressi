### **Performance Analysis Report for Tressi**

### 1. Overview

The Tressi application's original design was not suited for high-volume load testing due to significant architectural flaws. Key issues included unbounded in-memory storage of test results and inefficient, repetitive processing of growing datasets. These problems led to high memory consumption and increasing CPU usage, limiting the application's scalability and reliability.

Following a series of targeted fixes, these core issues have been resolved. By implementing a **streaming aggregation model** using HDR Histograms and circular buffers, Tressi is now a highly scalable and performant load testing tool. The critical bottlenecks related to memory growth, real-time calculations, and post-test processing have been eliminated, resulting in a robust and reliable application.

---

### 2. Performance Issues & Resolutions

#### 2.1. Unbounded In-Memory Result Storage

-   **Problem:** The `Runner` class previously stored every request result in memory for the entire test duration. This led to massive, unbounded memory growth that could crash the application during long or high-volume tests.

-   **Solution:** The application now uses an **HDR Histogram** to efficiently aggregate latency data without storing individual results. This change eliminates the risk of memory exhaustion and makes the tool suitable for large-scale testing.

#### 2.2. Inefficient Real-time RPS and Autoscaling Calculations

-   **Problem:** Real-time requests per second (RPS) and autoscaling calculations required filtering the entire, ever-growing results array. This operation became progressively slower, consuming significant CPU and slowing down the application's core logic.

-   **Solution:** The RPS calculation was re-implemented using a **CircularBuffer** to store only recent timestamps. This makes the calculation a highly efficient, constant-time operation, eliminating the performance bottleneck.

#### 2.3. Expensive Live Statistical Calculations

-   **Problem:** Live percentile calculations in the UI and logs were performed by repeatedly sorting a large, unbounded array of latencies. This caused high CPU usage and made the UI unresponsive during tests.

-   **Solution:** The UI now sources its data from the `Distribution` class, which relies on the HDR Histogram and an efficiently managed internal buffer. This avoids expensive sorting and processing of large arrays, ensuring the UI remains responsive.

#### 2.4. High Post-Test Processing Overhead

-   **Problem:** Generating summaries and reports at the end of a test required multiple passes over the entire, potentially huge, results array. This caused long delays and high memory usage, and in some cases, made the final results inaccurate.

-   **Solution:** The reporting functions now pull pre-aggregated and accurate data directly from the `Runner`'s efficient data structures. This makes the final processing step near-instantaneous and ensures the reports are both performant and correct.
