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

  /**
   * Creates a new TUI instance.
   * @param onExit A callback function to be called when the user exits the UI.
   */
  constructor(onExit: () => void) {
    this.screen = blessed.screen({ smartCSR: true });
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.latencyChart = grid.set(0, 0, 6, 12, contrib.line, {
      label: 'Latency (ms)',
      showLegend: false,
      maxY: 1000,
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
      ['Req/s (Actual/Target)', rpsStat],
      ['Success / Fail', `${successfulRequests} / ${failedRequests}`],
      ['Avg Latency (ms)', Math.round(averageLatency)],
      ['Time', `${elapsedSec.toFixed(0)}s / ${totalSec}s`],
      ['Workers', workerCount],
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
}
