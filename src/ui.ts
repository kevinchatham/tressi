import blessed from 'blessed';
import contrib from 'blessed-contrib';

import { CircularBuffer } from './circular-buffer';
import { Runner } from './runner';
import { getStatusCodeDistributionByCategory } from './stats';

/**
 * Manages the terminal user interface for Tressi.
 */
export class TUI {
  private screen: blessed.Widgets.Screen;
  private latencyChart: contrib.Widgets.LineElement;
  private responseCodeChart: contrib.Widgets.LineElement;
  private responseCodeLegend: blessed.Widgets.LineElement;
  private statsTable: contrib.Widgets.TableElement;
  private latencyDistributionTable: contrib.Widgets.TableElement;
  private tressiVersion: string;

  private successData: CircularBuffer<number>;
  private redirectData: CircularBuffer<number>;
  private clientErrorData: CircularBuffer<number>;
  private serverErrorData: CircularBuffer<number>;
  private avgLatencyData: CircularBuffer<number>;

  /**
   * Creates a new TUI instance.
   * @param onExit A callback function to be called when the user exits the UI.
   */
  constructor(onExit: () => void, tressiVersion: string) {
    this.screen = blessed.screen({ smartCSR: true });
    this.tressiVersion = tressiVersion;
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Initialize CircularBuffers for UI data with 100 items capacity
    this.successData = new CircularBuffer<number>(100);
    this.redirectData = new CircularBuffer<number>(100);
    this.clientErrorData = new CircularBuffer<number>(100);
    this.serverErrorData = new CircularBuffer<number>(100);
    this.avgLatencyData = new CircularBuffer<number>(100);

    this.latencyChart = grid.set(0, 0, 6, 6, contrib.line, {
      label: 'Avg Latency (ms)',
      showLegend: false,
      maxY: 1000,
      valign: 'bottom',
    });

    this.responseCodeChart = grid.set(0, 6, 6, 5, contrib.line, {
      label: 'Response Codes Over Time',
      showLegend: false,
      valign: 'bottom',
      wholeNumbersOnly: true,
    });

    this.responseCodeLegend = grid.set(0, 11, 6, 1, blessed.box, {
      content:
        `{green-fg}■ 2xx{/}\n` +
        `{yellow-fg}■ 3xx{/}\n` +
        `{red-fg}■ 4xx{/}\n` +
        `{magenta-fg}■ 5xx{/}`,
      tags: true,
    });

    this.statsTable = grid.set(6, 0, 6, 6, contrib.table, {
      label: 'Live Stats',
      interactive: false,
      columnWidth: [25, 20],
    });

    this.latencyDistributionTable = grid.set(6, 6, 6, 6, contrib.table, {
      label: 'Latency Distribution (ms)',
      interactive: false,
      columnSpacing: 1,
      columnWidth: [15, 10, 15, 15],
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

    blessed.text({
      parent: this.screen,
      bottom: 0,
      left: 0,
      content: `tressi v${this.tressiVersion}`,
      style: {
        fg: 'white',
      },
    });
  }

  /**
   * Updates the UI with new data from the load test.
   * @param runner The `Runner` instance for the test.
   * @param elapsedSec The elapsed time of the test in seconds.
   * @param totalSec The total duration of the test in seconds.
   * @param targetReqPerSec The target requests per second, if any.
   */
  public update(
    runner: Runner,
    elapsedSec: number,
    totalSec: number,
    targetReqPerSec: number | undefined,
  ): void {
    const histogram = runner.getHistogram();
    const statusCodeMap = runner.getStatusCodeMap();
    const currentReqPerSec = runner.getCurrentRps();
    const successfulRequests = runner.getSuccessfulRequestsCount();
    const failedRequests = runner.getFailedRequestsCount();
    const averageLatency = runner.getAverageLatency();
    const workerCount = runner.getWorkerCount();

    // Calculate average latency for the latest interval
    const avgLatencyForInterval = histogram.mean;

    this.avgLatencyData.add(avgLatencyForInterval);

    const latencyDistribution = runner.getLatencyDistribution({
      count: 10,
    });
    this.latencyDistributionTable.setData({
      headers: ['Range', 'Count', '% of Total', 'Cumulative'],
      data: latencyDistribution.map((b) => [
        b.latency,
        b.count,
        b.percent,
        b.cumulative,
      ]),
    });

    const currentDistribution =
      getStatusCodeDistributionByCategory(statusCodeMap);

    // Add new data points
    this.successData.add(currentDistribution['2xx']);
    this.redirectData.add(currentDistribution['3xx']);
    this.clientErrorData.add(currentDistribution['4xx']);
    this.serverErrorData.add(currentDistribution['5xx']);

    // Get data as arrays for chart rendering
    const successArray = this.successData.getAll();
    const redirectArray = this.redirectData.getAll();
    const clientErrorArray = this.clientErrorData.getAll();
    const serverErrorArray = this.serverErrorData.getAll();
    const avgLatencyArray = this.avgLatencyData.getAll();

    const dataPointsCount = successArray.length;

    const x_labels = Array.from({ length: dataPointsCount }, (_, i) => {
      const timeAgoSec = (dataPointsCount - 1 - i) * 0.5;
      const timeSec = elapsedSec - timeAgoSec;
      return timeSec < 0 ? `0s` : `${Math.round(timeSec)}s`;
    });

    this.latencyChart.setData([
      {
        title: 'Latency',
        x: x_labels,
        y: avgLatencyArray.map((x: number) => Math.round(x)),
      },
    ]);

    const series = [];
    if (successArray.some((v: number) => v > 0)) {
      series.push({
        title: '2xx',
        x: x_labels,
        y: successArray,
        style: { line: 'green' },
      });
    }
    if (redirectArray.some((v: number) => v > 0)) {
      series.push({
        title: '3xx',
        x: x_labels,
        y: redirectArray,
        style: { line: 'yellow' },
      });
    }
    if (clientErrorArray.some((v: number) => v > 0)) {
      series.push({
        title: '4xx',
        x: x_labels,
        y: clientErrorArray,
        style: { line: 'red' },
      });
    }
    if (serverErrorArray.some((v: number) => v > 0)) {
      series.push({
        title: '5xx',
        x: x_labels,
        y: serverErrorArray,
        style: { line: 'magenta' },
      });
    }

    if (series.length === 0) {
      this.responseCodeChart.setData([
        {
          title: '',
          x: [],
          y: [],
        },
      ]);
    } else {
      this.responseCodeChart.setData(series);
    }

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
}
