import blessed from 'blessed';
import contrib from 'blessed-contrib';

export class TUI {
  private screen: blessed.Widgets.Screen;
  private latencyChart: contrib.Widgets.LineElement;
  private statusChart: contrib.Widgets.BarElement;

  constructor(onExit: () => void) {
    this.screen = blessed.screen({ smartCSR: true });
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.latencyChart = grid.set(0, 0, 6, 12, contrib.line, {
      label: 'Latency (ms)',
      showLegend: false,
      maxY: 1000,
    });

    this.statusChart = grid.set(6, 0, 6, 12, contrib.bar, {
      label: 'Status Codes',
      barWidth: 6,
      barSpacing: 4,
      xOffset: 0,
      maxHeight: 100,
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      onExit();
    });
  }

  public updateCharts(latencies: number[], statusCodeMap: Record<number, number>): void {
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

    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }
} 