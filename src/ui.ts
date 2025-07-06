import blessed from 'blessed';
import contrib from 'blessed-contrib';

/**
 * Manages the terminal user interface for Tressi.
 */
export class TUI {
  private screen: blessed.Widgets.Screen;
  private latencyChart: contrib.Widgets.LineElement;
  private statusChart: contrib.Widgets.BarElement;
  private statsTable: contrib.Widgets.TableElement;
  private latencyDistributionTable: contrib.Widgets.TableElement;

  /**
   * Creates a new TUI instance.
   * @param onExit A callback function to be called when the user exits the UI.
   */
  constructor(onExit: () => void) {
    this.screen = blessed.screen({ smartCSR: true });
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.latencyChart = grid.set(0, 0, 6, 6, contrib.line, {
      label: 'Latency (ms)',
      showLegend: false,
      maxY: 1000,
    });

    this.latencyDistributionTable = grid.set(0, 6, 6, 6, contrib.table, {
      label: 'Latency Distribution (ms)',
      interactive: false,
      columnSpacing: 1,
      columnWidth: [12, 10, 10, 11, 20],
    });

    this.statsTable = grid.set(6, 0, 6, 6, contrib.table, {
      label: 'Live Stats',
      interactive: false,
      columnWidth: [25, 20],
    });

    this.statusChart = grid.set(6, 6, 6, 6, contrib.bar, {
      label: 'Status Codes',
      barWidth: 5,
      barSpacing: 1,
      xOffset: 1,
      maxHeight: 100,
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      onExit();
    });

    blessed.text({
      parent: this.screen,
      bottom: 0,
      left: 'center',
      content: ' q / esc / ctrl+c to quit ',
      style: {
        fg: 'white',
      },
    });
  }

  /**
   * Updates the UI with new data from the load test.
   * @param latencies An array of recent latency values.
   * @param statusCodeMap A map of status codes to their counts.
   * @param currentReqPerSec The current requests per second.
   * @param elapsedSec The elapsed time of the test in seconds.
   * @param totalSec The total duration of the test in seconds.
   * @param targetReqPerSec The target requests per second, if any.
   * @param successfulRequests The total number of successful requests.
   * @param failedRequests The total number of failed requests.
   * @param averageLatency The average latency of all requests.
   * @param workerCount The current number of active workers.
   */
  public update(
    latencies: number[],
    statusCodeMap: Record<number, number>,
    currentReqPerSec: number,
    elapsedSec: number,
    totalSec: number,
    targetReqPerSec: number | undefined,
    successfulRequests: number,
    failedRequests: number,
    averageLatency: number,
    workerCount: number,
  ): void {
    const times = latencies.slice(-30);
    this.latencyChart.setData([
      {
        title: 'Latency',
        x: times.map((_, i) => `${i}`),
        y: times.map((x) => Math.round(x)),
      },
    ]);

    const latencyDistribution = this.getLatencyDistribution(latencies);
    this.latencyDistributionTable.setData({
      headers: ['Range (ms)', 'Count', '% Total', 'Cumulative', 'Chart'],
      data: latencyDistribution.map((b) => [
        b.range,
        b.count,
        b.percent,
        b.cumulative,
        b.chart,
      ]),
    });

    const codes = Object.keys(statusCodeMap).sort(
      (a, b) => Number(a) - Number(b),
    );
    const counts = codes.map((code) => statusCodeMap[+code] || 0);

    this.statusChart.setData({
      titles: codes,
      data: counts,
    });

    const rpsStat = targetReqPerSec
      ? `${currentReqPerSec} / ${targetReqPerSec}`
      : currentReqPerSec.toString();

    const data: (string | number)[][] = [
      ['Time', `${elapsedSec.toFixed(0)}s / ${totalSec}s`],
      ['Workers', workerCount],
      ['Req/s (Actual/Target)', rpsStat],
      ['Success / Fail', `${successfulRequests} / ${failedRequests}`],
      ['Avg Latency (ms)', Math.round(averageLatency)],
    ];

    this.statsTable.setData({
      headers: ['Stat', 'Value'],
      data: data.map((row) => row.map((cell) => cell.toString())),
    });

    this.screen.render();
  }

  /**
   * Destroys the TUI screen, cleaning up resources.
   */
  public destroy(): void {
    this.screen.destroy();
  }
  private getLatencyDistribution(
    latencies: number[],
    bucketCount = 6,
  ): {
    range: string;
    count: string;
    percent: string;
    cumulative: string;
    chart: string;
  }[] {
    if (latencies.length === 0) {
      return [];
    }

    const totalCount = latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const range = maxLatency - minLatency;
    const bucketSize = Math.ceil(range / bucketCount) || 1;

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const lowerBound = Math.floor(minLatency + i * bucketSize);
      const upperBound = Math.floor(minLatency + (i + 1) * bucketSize - 1);
      return {
        range: `${lowerBound}-${upperBound}`,
        count: 0,
        lowerBound,
        upperBound,
      };
    });

    // Make the last bucket catch all remaining values
    buckets[buckets.length - 1].upperBound = Infinity;
    buckets[buckets.length - 1].range =
      `${buckets[buckets.length - 1].lowerBound}+`;

    for (const latency of latencies) {
      const targetBucket = buckets.find(
        (b) => latency >= b.lowerBound && latency <= b.upperBound,
      );
      if (targetBucket) {
        targetBucket.count++;
      }
    }

    const maxCount = Math.max(...buckets.map((b) => b.count));
    let cumulativeCount = 0;

    return buckets.map((bucket) => {
      const percentOfTotal =
        totalCount > 0 ? (bucket.count / totalCount) * 100 : 0;
      cumulativeCount += bucket.count;
      const cumulativePercent =
        totalCount > 0 ? (cumulativeCount / totalCount) * 100 : 0;

      const chartBarCount =
        maxCount > 0 ? Math.round((bucket.count / maxCount) * 15) : 0;
      const chart = '█'.repeat(chartBarCount);

      return {
        range: bucket.range,
        count: bucket.count.toString(),
        percent: `${percentOfTotal.toFixed(1)}%`,
        cumulative: `${cumulativePercent.toFixed(1)}%`,
        chart,
      };
    });
  }
}
