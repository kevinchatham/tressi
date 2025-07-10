import blessed from 'blessed';
import contrib from 'blessed-contrib';

import {
  getLatencyDistribution,
  getStatusCodeDistributionByCategory,
} from './distribution';
import { Runner } from './runner';
import { average } from './stats';

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

  private successData: number[] = [];
  private redirectData: number[] = [];
  private clientErrorData: number[] = [];
  private serverErrorData: number[] = [];
  private avgLatencyData: number[] = [];

  /**
   * Creates a new TUI instance.
   * @param onExit A callback function to be called when the user exits the UI.
   */
  constructor(onExit: () => void, tressiVersion: string) {
    this.screen = blessed.screen({ smartCSR: true });
    this.tressiVersion = tressiVersion;
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

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
    const latencies = runner.getLatencies();
    const statusCodeMap = runner.getStatusCodeMap();
    const currentReqPerSec = runner.getCurrentRps();
    const successfulRequests = runner.getSuccessfulRequestsCount();
    const failedRequests = runner.getFailedRequestsCount();
    const averageLatency = runner.getAverageLatency();
    const workerCount = runner.getWorkerCount();

    // Calculate average latency for the latest interval
    const avgLatencyForInterval = average(latencies.slice(-100)); // Use a sample for interval avg

    const maxDataPoints = 30; // Same as response codes
    this.avgLatencyData.push(avgLatencyForInterval);
    if (this.avgLatencyData.length > maxDataPoints) {
      this.avgLatencyData.shift();
    }

    const latencyDistribution = getLatencyDistribution(latencies);
    this.latencyDistributionTable.setData({
      headers: ['Range', 'Count', '% of Total', 'Cumulative'],
      data: latencyDistribution.map((b) => [
        b.range,
        b.count,
        b.percent,
        b.cumulative,
      ]),
    });

    const currentDistribution =
      getStatusCodeDistributionByCategory(statusCodeMap);

    // Add new data points and trim old ones
    const dataPointsCount = this.successData.length;
    this.successData.push(currentDistribution['2xx']);
    this.redirectData.push(currentDistribution['3xx']);
    this.clientErrorData.push(currentDistribution['4xx']);
    this.serverErrorData.push(currentDistribution['5xx']);

    if (this.successData.length > maxDataPoints) {
      this.successData.shift();
      this.redirectData.shift();
      this.clientErrorData.shift();
      this.serverErrorData.shift();
    }

    const x_labels = Array.from({ length: dataPointsCount }, (_, i) => {
      const timeAgoSec = (dataPointsCount - 1 - i) * 0.5;
      const timeSec = elapsedSec - timeAgoSec;
      return timeSec < 0 ? `0s` : `${Math.round(timeSec)}s`;
    });

    this.latencyChart.setData([
      {
        title: 'Latency',
        x: x_labels,
        y: this.avgLatencyData.map((x) => Math.round(x)),
      },
    ]);

    const series = [];
    if (this.successData.some((v) => v > 0)) {
      series.push({
        title: '2xx',
        x: x_labels,
        y: this.successData,
        style: { line: 'green' },
      });
    }
    if (this.redirectData.some((v) => v > 0)) {
      series.push({
        title: '3xx',
        x: x_labels,
        y: this.redirectData,
        style: { line: 'yellow' },
      });
    }
    if (this.clientErrorData.some((v) => v > 0)) {
      series.push({
        title: '4xx',
        x: x_labels,
        y: this.clientErrorData,
        style: { line: 'red' },
      });
    }
    if (this.serverErrorData.some((v) => v > 0)) {
      series.push({
        title: '5xx',
        x: x_labels,
        y: this.serverErrorData,
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
