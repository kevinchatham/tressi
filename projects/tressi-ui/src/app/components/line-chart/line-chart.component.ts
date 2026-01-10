import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import humanNumber from 'human-number';
import { ApexMarkers, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexStroke,
  ApexTitleSubtitle,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { ChartSyncService } from '../../services/chart-sync.service';
import { ThemeService } from '../../services/theme.service';
import { IconComponent } from '../icon/icon.component';

type ChartEventData = {
  event: MouseEvent;
  chartContext: unknown;
  config: unknown;
};

export type LineChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  title: ApexTitleSubtitle;
  grid: ApexGrid;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  tooltip: ApexTooltip;
  markers: ApexMarkers;
};

@Component({
  selector: 'app-line-chart',
  imports: [NgApexchartsModule],
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent {
  readonly chart = viewChild<ChartComponent>('chart');

  readonly title = input<string>('');
  readonly yAxisLabel = input<string>('');
  readonly data = input<number[]>([]);
  readonly labels = input<number[]>([]);
  readonly seriesName = input<string>('Series');
  readonly height = input<number>(350);
  readonly enableToolbar = input<boolean>(true);
  readonly smoothCurve = input<boolean>(true);
  readonly chartId = input<string>();
  readonly testTimeRange = input<{ min: number; max: number } | null>(null);

  readonly chartClick = output<ChartEventData>();
  readonly chartMouseMove = output<ChartEventData>();

  private readonly themeService = inject(ThemeService);
  private readonly syncService = inject(ChartSyncService);

  public readonly chartOptions = computed(() => this.createChartOptions());
  public readonly isMaster = computed(
    () => this.chartId() === this.syncService.lastInteractedChartId(),
  );

  // State tracking for efficient updates
  private lastDataLength = 0;

  // Add computed property for effective initial state
  private readonly effectiveInitialState = computed(() => {
    const globalRange = this.testTimeRange();
    if (globalRange) {
      return globalRange;
    }

    const labels = this.labels();
    if (labels.length > 0) {
      const dataRange = {
        min: Math.min(...labels),
        max: Math.max(...labels),
      };
      return dataRange;
    }

    return null;
  });

  constructor() {
    // Register chart when chartId is available
    effect(() => {
      const chartId = this.chartId();
      if (chartId) {
        this.syncService.registerChart(chartId);
      }
    });

    // Sync to master state when not the master chart
    effect(() => {
      const chartId = this.chartId();
      const chart = this.chart();
      const lastInteracted = this.syncService.lastInteractedChartId();

      if (chartId && chart && chartId !== lastInteracted) {
        this.syncToMasterState();
      }
    });

    // Setup reset handler when chart is available
    effect(() => {
      if (this.chart()) {
        this.setupCustomResetHandler();
      }
    });

    // Update chart when theme or data changes
    effect(() => {
      this.themeService.getChartColors();
      this.updateChart();
    });
  }

  private createChartOptions(): LineChartOptions {
    const themeColors = this.themeService.getChartColors();
    const seriesName = this.seriesName();
    const data = this.data();
    const labels = this.labels();
    const height = this.height();
    const enableToolbar = this.enableToolbar();
    const smoothCurve = this.smoothCurve();
    const title = this.title();
    const yAxisLabel = this.yAxisLabel();

    // Calculate data boundaries for x-axis constraints using effective initial state
    const effectiveState = this.effectiveInitialState();
    const minBoundary = effectiveState?.min;
    const maxBoundary = effectiveState?.max;

    // Convert data and labels to proper format for datetime chart
    const seriesData = data.map((value, index) => ({
      x: labels[index] || Date.now() - (data.length - 1 - index) * 1000,
      y: value,
    }));

    const zoomInSvg = IconComponent.asHtml('zoom_in');
    const zoomOutSvg = IconComponent.asHtml('zoom_out');
    const resetSvg = IconComponent.asHtml('reset_focus');
    const panSvg = IconComponent.asHtml('drag_pan');
    const selectSvg = IconComponent.asHtml('select');

    return {
      series: [
        {
          name: seriesName,
          data: seriesData,
        },
      ],
      chart: {
        offsetX: 4,
        height: height,
        type: 'line',
        zoom: {
          enabled: enableToolbar,
          type: 'x',
          autoScaleYaxis: true,
          allowMouseWheelZoom: true,
          zoomedArea: {
            fill: {
              color: themeColors.primary,
              opacity: 0.3108,
            },
            stroke: {
              color: themeColors.primary,
              opacity: 0.3108,
              width: 1,
            },
          },
        },
        toolbar: {
          show: enableToolbar,
          tools: {
            download: false,
            selection: selectSvg, // Enable selection tool
            zoom: selectSvg, // Enable default zoom
            zoomin: zoomInSvg, // Enable default zoom in
            zoomout: zoomOutSvg, // Enable default zoom out
            pan: panSvg, // Enable pan
            reset: resetSvg, // Enable reset
            customIcons: [], // Add custom icons
          },
          export: {
            csv: { filename: undefined },
            svg: { filename: undefined },
            png: { filename: undefined },
          },
          autoSelected: 'zoom' as const,
        },
        background: themeColors.background,
        foreColor: themeColors.text,
        events: {
          click: (event, chartContext, config): void => {
            this.handleChartClick();
            this.chartClick.emit({ event, chartContext, config });
          },
          mouseMove: (event, chartContext, config): void => {
            this.chartMouseMove.emit({ event, chartContext, config });
          },
          zoomed: (_chartContext, { xaxis }): void => {
            this.handleZoomOrPan(xaxis);
          },
          selection: (_chartContext, { xaxis }): void => {
            this.handleSelection(xaxis);
          },
          scrolled: (_chartContext, { xaxis }): void => {
            this.handleZoomOrPan(xaxis);
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: smoothCurve ? 'monotoneCubic' : 'linestep',
        width: 2,
        colors: [themeColors.primary],
      },
      title: {
        text: title,
        align: 'left',
        style: {
          color: themeColors.text,
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: 'Open Sans, sans-serif',
        },
      },
      grid: {
        borderColor: themeColors.border,
        strokeDashArray: 0,
        row: {
          colors: [themeColors.grid, 'transparent'],
          opacity: 0.5,
        },
      },
      xaxis: {
        type: 'datetime',
        min: minBoundary, // Prevent zoom before data starts
        max: maxBoundary, // Prevent zoom after data ends
        labels: {
          show: data.length > 1,
          style: {
            colors: themeColors.text,
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '11px',
          },
          datetimeFormatter: {
            year: 'yyyy',
            month: 'MMM',
            day: 'dd',
            hour: 'h:mm',
            minute: 'h:mm:ss',
            second: 'h:mm:ss',
          },
          hideOverlappingLabels: true,
          formatter: (value: string | number): string => {
            // Convert timestamp to local timezone
            const date = new Date(value);
            return date.toLocaleTimeString();
          },
        },
        axisBorder: {
          color: themeColors.border,
        },
        axisTicks: {
          color: themeColors.border,
        },
        tooltip: {
          enabled: false,
        },
      },
      yaxis: {
        title: {
          text: yAxisLabel,
          style: {
            color: themeColors.text,
            fontSize: '12px',
            fontWeight: 'normal',
            fontFamily: 'Open Sans, sans-serif',
          },
        },
        labels: {
          offsetX: 8,
          style: {
            colors: themeColors.text,
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '11px',
          },
          formatter: this.getYAxisFormatter(),
        },
        axisBorder: {
          color: themeColors.border,
        },
        axisTicks: {
          color: themeColors.border,
        },
      },
      tooltip: {
        theme: 'false',
        style: {
          fontSize: '12px',
          fontFamily: 'Roboto Mono, monospace',
        },
        fillSeriesColor: false,
      },
      markers: {
        size: 0,
        colors: [themeColors.primary],
        strokeColors: [themeColors.primary],
        strokeWidth: 2,
        strokeOpacity: 0.9,
        strokeDashArray: 0,
        fillOpacity: 1,
        discrete: [],
        shape: 'circle',
        offsetX: 0,
        offsetY: 0,
        onClick: undefined,
        onDblClick: undefined,
        showNullDataPoints: true,
        hover: {
          size: 6,
          sizeOffset: 3,
        },
      },
    };
  }

  private handleChartClick(): void {
    const chartId = this.chartId();
    if (chartId) {
      this.syncService.setAsMaster(chartId);
    }
  }

  private handleZoomOrPan(xaxis: { min: number; max: number }): void {
    const chartId = this.chartId();
    if (chartId) {
      this.syncService.setAsMaster(chartId);
      this.syncService.broadcastState({
        xAxisMin: xaxis.min,
        xAxisMax: xaxis.max,
        selectionStart: null,
        selectionEnd: null,
      });
    }
  }

  private handleSelection(xaxis: { min: number; max: number }): void {
    const chartId = this.chartId();
    if (chartId) {
      this.syncService.setAsMaster(chartId);
      this.syncService.broadcastState({
        selectionStart: xaxis.min,
        selectionEnd: xaxis.max,
        xAxisMin: null,
        xAxisMax: null,
      });
    }
  }

  private syncToMasterState(): void {
    const chart = this.chart();
    if (!chart) return;

    const state = this.syncService.getState();

    // Add a small delay to ensure chart is fully initialized
    setTimeout(() => {
      if (state.xAxisMin !== null && state.xAxisMax !== null) {
        // Use zoomX instead of updateOptions for consistency
        if (chart.zoomX) {
          chart.zoomX(state.xAxisMin, state.xAxisMax);
        } else {
          // Fallback to updateOptions if zoomX not available
          chart.updateOptions(
            {
              xaxis: {
                min: state.xAxisMin,
                max: state.xAxisMax,
              },
            },
            false,
            false,
          );
        }
      } else if (state.selectionStart !== null && state.selectionEnd !== null) {
        // Handle selection-based zoom if needed
        if (chart.zoomX) {
          chart.zoomX(state.selectionStart, state.selectionEnd);
        } else {
          chart.updateOptions(
            {
              xaxis: {
                min: state.selectionStart,
                max: state.selectionEnd,
              },
            },
            false,
            false,
          );
        }
      }
    }, 100); // 100ms delay to ensure chart is ready
  }

  private updateChart(): void {
    const seriesName = this.seriesName();
    const data = this.data();
    const labels = this.labels();

    const chart = this.chart();
    if (!chart) return;

    // Early exit if data hasn't changed
    if (data.length === this.lastDataLength && data.length > 0) {
      return;
    }

    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      // Convert data and labels to proper format for datetime chart
      const seriesData = data.map((value, index) => ({
        x: labels[index] || Date.now() - (data.length - 1 - index) * 1000,
        y: value,
      }));

      // Determine if we should use incremental update
      const shouldUseIncremental = this.shouldUseIncrementalUpdate(data);

      if (shouldUseIncremental && this.lastDataLength > 0) {
        // Use appendData for incremental updates
        const newDataPoints = this.getIncrementalDataPoints(seriesData);
        if (newDataPoints.length > 0) {
          chart.appendData([
            {
              name: seriesName,
              data: newDataPoints,
            },
          ]);
        }
      } else {
        // Use full update for initial load or major data changes
        chart.updateSeries([
          {
            name: seriesName,
            data: seriesData,
          },
        ]);
      }

      // Update tracking state
      this.lastDataLength = data.length;
    });
  }

  private shouldUseIncrementalUpdate(newData: number[]): boolean {
    if (this.lastDataLength === 0) {
      return false; // First load, use full update
    }

    if (newData.length < this.lastDataLength) {
      return false; // Data reset, use full update
    }

    if (newData.length - this.lastDataLength > 20) {
      return false; // Large batch, use full update
    }

    return newData.length > this.lastDataLength;
  }

  private getIncrementalDataPoints(
    seriesData: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    // Return only the new data points since last update
    const expectedLength = this.lastDataLength;
    if (seriesData.length <= expectedLength) {
      return [];
    }

    return seriesData.slice(expectedLength);
  }

  private getYAxisFormatter(): (value: number) => string {
    return (value: number): string => {
      return humanNumber(Math.round(value));
    };
  }

  private setupCustomResetHandler(): void {
    const chart = this.chart();
    if (!chart) return;

    const originalReset = chart.resetSeries.bind(chart);
    chart.resetSeries = (): void => {
      const chartId = this.chartId();
      if (!chartId) {
        return originalReset();
      }

      const initialState = this.effectiveInitialState();

      if (initialState) {
        // 1. Broadcast to sync service (for other charts)
        this.syncService.broadcastState({
          xAxisMin: initialState.min,
          xAxisMax: initialState.max,
          selectionStart: null,
          selectionEnd: null,
        });

        // 2. Use zoomX method to reset this chart instance
        if (chart.zoomX) {
          chart.zoomX(initialState.min, initialState.max);
        } else {
          // Fallback if zoomX is not available
          chart.updateOptions(
            {
              xaxis: {
                min: initialState.min,
                max: initialState.max,
              },
            },
            true,
            true,
          );
        }
      }

      // Skip originalReset - we've handled it manually
    };
  }
}
