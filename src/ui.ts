import blessed from 'blessed';
import contrib from 'blessed-contrib';

export class TUI {
  private screen: blessed.Widgets.Screen;
  private latencyChart: contrib.Widgets.LineElement;
  private statusChart: contrib.Widgets.BarElement;
  private statsTable: contrib.Widgets.TableElement;

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
      columnWidth: [15, 10],
    });

    this.statusChart = grid.set(6, 6, 6, 6, contrib.bar, {
      label: 'Status Codes',
      barWidth: 6,
      barSpacing: 2,
      xOffset: 0,
      maxHeight: 100,
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      onExit();
    });
  }

  public update(
    latencies: number[],
    statusCodeMap: Record<number, number>,
    currentRpm: number,
    elapsedSec: number,
    totalSec: number,
  ): void {
    const times = latencies.slice(-30);
    this.latencyChart.setData([
      {
        title: 'Latency',
        x: times.map((_, i) => `${i}`),
        y: times.map((x) => Math.round(x)),
      },
    ]);

    const codes = Object.keys(statusCodeMap);
    const counts = codes.map((code) => statusCodeMap[+code] || 0);

    this.statusChart.setData({
      titles: codes,
      data: counts,
    });

    this.statsTable.setData({
      headers: ['Stat', 'Value'],
      data: [
        ['RPS', currentRpm.toString()],
        ['Time', `${elapsedSec.toFixed(0)}s / ${totalSec}s`],
      ],
    });

    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }
}
