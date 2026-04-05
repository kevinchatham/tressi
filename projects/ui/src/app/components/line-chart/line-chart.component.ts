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
import type { ChartEventData, LineChartOptions } from '@tressi/shared/ui';
import humanNumber from 'human-number';
import { type ApexAxisChartSeries, type ChartComponent, NgApexchartsModule } from 'ng-apexcharts';

import { ChartSyncService } from '../../services/chart-sync.service';
import { ThemeService } from '../../services/theme.service';
import { IconComponent } from '../icon/icon.component';

type XAxis = {
  xaxis: {
    min: number;
    max: number;
  };
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  selector: 'app-line-chart',
  styleUrls: ['./line-chart.component.css'],
  templateUrl: './line-chart.component.html',
})
export class LineChartComponent {
  private readonly _themeService = inject(ThemeService);
  private readonly _syncService = inject(ChartSyncService);

  readonly chart = viewChild<ChartComponent>('chart');

  readonly title = input<string>('');
  readonly yAxisLabel = input<string>('');
  readonly data = input<number[] | { [seriesName: string]: number[] }>([]);
  readonly labels = input<number[]>([]);
  readonly seriesName = input<string>('Series');
  readonly height = input<number>(350);
  readonly enableToolbar = input<boolean>(true);
  readonly smoothCurve = input<boolean>(true);
  readonly chartId = input<string>();
  readonly testTimeRange = input<{ min: number; max: number } | null>(null);

  readonly chartClick = output<ChartEventData>();
  readonly chartMouseMove = output<ChartEventData>();

  readonly chartOptions = computed(() => this._createChartOptions());
  readonly isMaster = computed(() => this.chartId() === this._syncService.lastInteractedChartId());

  // State tracking for efficient updates
  private _lastDataLength = 0;

  // Add computed property for effective initial state
  private readonly _effectiveInitialState = computed(() => {
    const globalRange = this.testTimeRange();
    if (globalRange) {
      return globalRange;
    }

    const labels = this.labels();
    if (labels.length > 0) {
      const dataRange = {
        max: Math.max(...labels),
        min: Math.min(...labels),
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
        this._syncService.registerChart(chartId);
      }
    });

    // Sync to master state when not the master chart
    effect(() => {
      const chartId = this.chartId();
      const chart = this.chart();
      const lastInteracted = this._syncService.lastInteractedChartId();

      if (chartId && chart && chartId !== lastInteracted) {
        this._syncToMasterState();
      }
    });

    // Setup reset handler when chart is available
    effect(() => {
      if (this.chart()) {
        this._setupCustomResetHandler();
      }
    });

    // Update chart when theme or data changes
    effect(() => {
      this._themeService.getChartColors();
      this._updateChart();
    });
  }

  private _createChartOptions(): LineChartOptions {
    const themeColors = this._themeService.getChartColors();
    const seriesName = this.seriesName();
    const data = this.data();
    const labels = this.labels();
    const height = this.height();
    const enableToolbar = this.enableToolbar();
    const smoothCurve = this.smoothCurve();
    const title = this.title();
    const yAxisLabel = this.yAxisLabel();

    // Calculate data boundaries for x-axis constraints using effective initial state
    const effectiveState = this._effectiveInitialState();
    const minBoundary = effectiveState?.min;
    const maxBoundary = effectiveState?.max;

    // Handle both single series and multi-series data
    let series: ApexAxisChartSeries;
    let dataLength = 0;

    if (Array.isArray(data)) {
      // Single series data
      const seriesData = data.map((value, index) => ({
        x: labels[index] || Date.now() - (data.length - 1 - index) * 1000,
        y: value,
      }));

      series = [
        {
          data: seriesData,
          name: seriesName,
        },
      ];
      dataLength = data.length;
    } else {
      // Multi-series data
      series = Object.entries(data).map(([name, values]) => {
        const seriesData = values.map((value, index) => ({
          x: labels[index] || Date.now() - (values.length - 1 - index) * 1000,
          y: value,
        }));
        dataLength = Math.max(dataLength, values.length);
        return {
          data: seriesData,
          name,
        };
      });
    }

    const zoomInSvg = IconComponent.asHtml('zoom_in');
    const zoomOutSvg = IconComponent.asHtml('zoom_out');
    const resetSvg = IconComponent.asHtml('reset_focus');
    const panSvg = IconComponent.asHtml('drag_pan');
    const selectSvg = IconComponent.asHtml('select');

    return {
      chart: {
        background: themeColors.background,
        events: {
          click: (event: MouseEvent, chartContext: unknown, config: unknown): void => {
            this._handleChartClick();
            this.chartClick.emit({ chartContext, config, event });
          },
          mouseMove: (event: MouseEvent, chartContext: unknown, config: unknown): void => {
            this.chartMouseMove.emit({ chartContext, config, event });
          },
          scrolled: (_chartContext: unknown, { xaxis }: XAxis): void => {
            this._handleZoomOrPan(xaxis);
          },
          selection: (_chartContext: unknown, { xaxis }: XAxis): void => {
            this._handleSelection(xaxis);
          },
          zoomed: (_chartContext: unknown, { xaxis }: XAxis): void => {
            this._handleZoomOrPan(xaxis);
          },
        },
        foreColor: themeColors.text,
        height: height,
        offsetX: 4,
        toolbar: {
          autoSelected: 'zoom' as const,
          export: {
            csv: { filename: undefined },
            png: { filename: undefined },
            svg: { filename: undefined },
          },
          show: enableToolbar,
          tools: {
            customIcons: [], // Add custom icons
            download: false,
            pan: panSvg, // Enable pan
            reset: resetSvg, // Enable reset
            selection: selectSvg, // Enable selection tool
            zoom: selectSvg, // Enable default zoom
            zoomin: zoomInSvg, // Enable default zoom in
            zoomout: zoomOutSvg, // Enable default zoom out
          },
        },
        type: 'line',
        zoom: {
          allowMouseWheelZoom: true,
          autoScaleYaxis: true,
          enabled: enableToolbar,
          type: 'x',
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
      },
      dataLabels: {
        enabled: false,
      },
      grid: {
        borderColor: themeColors.border,
        row: {
          colors: [themeColors.grid, 'transparent'],
          opacity: 0.5,
        },
        strokeDashArray: 0,
      },
      markers: {
        colors: [themeColors.primary],
        discrete: [],
        fillOpacity: 1,
        hover: {
          size: 6,
          sizeOffset: 3,
        },
        offsetX: 0,
        offsetY: 0,
        onClick: undefined,
        onDblClick: undefined,
        shape: 'circle',
        showNullDataPoints: true,
        size: this._getDataLength(data) > 1 ? 0 : 4,
        strokeColors: [themeColors.primary],
        strokeDashArray: 0,
        strokeOpacity: 0.9,
        strokeWidth: 2,
      },
      series,
      stroke: {
        colors: [themeColors.primary],
        curve: smoothCurve ? 'monotoneCubic' : 'linestep',
        width: 2,
      },
      title: {
        align: 'left',
        style: {
          color: themeColors.text,
          fontFamily: 'Open Sans, sans-serif',
          fontSize: '16px',
          fontWeight: 'bold',
        },
        text: title,
      },
      tooltip: {
        fillSeriesColor: false,
        style: {
          fontFamily: 'Roboto Mono, monospace',
          fontSize: '12px',
        },
        theme: 'false',
      },
      xaxis: {
        axisBorder: {
          color: themeColors.border,
        },
        axisTicks: {
          color: themeColors.border,
        },
        labels: {
          datetimeFormatter: {
            day: 'dd',
            hour: 'h:mm',
            minute: 'h:mm:ss',
            month: 'MMM',
            second: 'h:mm:ss',
            year: 'yyyy',
          },
          formatter: (value: string | number): string => {
            // Convert timestamp to local timezone
            const date = new Date(value);
            return date.toLocaleTimeString();
          },
          hideOverlappingLabels: true,
          show: this._getDataLength(data) > 1,
          style: {
            colors: themeColors.text,
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '11px',
          },
        },
        max: maxBoundary, // Prevent zoom after data ends
        min: minBoundary, // Prevent zoom before data starts
        tooltip: {
          enabled: false,
        },
        type: 'datetime',
      },
      yaxis: {
        axisBorder: {
          color: themeColors.border,
        },
        axisTicks: {
          color: themeColors.border,
        },
        labels: {
          formatter: this._getYAxisFormatter(),
          offsetX: 8,
          style: {
            colors: themeColors.text,
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '11px',
          },
        },
        title: {
          style: {
            color: themeColors.text,
            fontFamily: 'Open Sans, sans-serif',
            fontSize: '12px',
            fontWeight: 'normal',
          },
          text: yAxisLabel,
        },
      },
    };
  }

  private _handleChartClick(): void {
    const chartId = this.chartId();
    if (chartId) {
      this._syncService.setAsMaster(chartId);
    }
  }

  private _handleZoomOrPan(xaxis: { min: number; max: number }): void {
    const chartId = this.chartId();
    if (chartId) {
      this._syncService.setAsMaster(chartId);
      this._syncService.broadcastState({
        selectionEnd: null,
        selectionStart: null,
        xAxisMax: xaxis.max,
        xAxisMin: xaxis.min,
      });
    }
  }

  private _handleSelection(xaxis: { min: number; max: number }): void {
    const chartId = this.chartId();
    if (chartId) {
      this._syncService.setAsMaster(chartId);
      this._syncService.broadcastState({
        selectionEnd: xaxis.max,
        selectionStart: xaxis.min,
        xAxisMax: null,
        xAxisMin: null,
      });
    }
  }

  private _syncToMasterState(): void {
    const chart = this.chart();
    if (!chart) return;

    const state = this._syncService.getState();

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
                max: state.xAxisMax,
                min: state.xAxisMin,
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
                max: state.selectionEnd,
                min: state.selectionStart,
              },
            },
            false,
            false,
          );
        }
      }
    }, 100); // 100ms delay to ensure chart is ready
  }

  private _updateChart(): void {
    const data = this.data();
    const labels = this.labels();

    const chart = this.chart();
    if (!chart) return;

    // Get data length for change detection
    let dataLength: number;
    if (Array.isArray(data)) {
      dataLength = data.length;
    } else if (typeof data === 'object' && data !== null) {
      dataLength = Math.max(...Object.values(data).map((arr) => arr?.length || 0));
    } else {
      dataLength = 0;
    }

    // Early exit if data hasn't changed
    if (dataLength === this._lastDataLength && dataLength > 0) {
      return;
    }

    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      let series: ApexAxisChartSeries = [];

      if (Array.isArray(data)) {
        // Single series data
        const seriesData = data.map((value: number, index: number) => ({
          x: labels[index] || Date.now() - (data.length - 1 - index) * 1000,
          y: value,
        }));

        series = [
          {
            data: seriesData,
            name: this.seriesName(),
          },
        ];
      } else if (typeof data === 'object' && data !== null) {
        // Multi-series data
        series = Object.entries(data).map(([seriesName, values]) => {
          const seriesData = values.map((value: number, index: number) => ({
            x: labels[index] || Date.now() - (values.length - 1 - index) * 1000,
            y: value,
          }));
          return {
            data: seriesData,
            name: seriesName,
          };
        });
      }

      // Always use full update for simplicity with multi-series
      chart.updateSeries(series);

      // Update tracking state
      this._lastDataLength = dataLength;
    });
  }

  private _getYAxisFormatter(): (value: number) => string {
    return (value: number): string => {
      return humanNumber(Math.round(value));
    };
  }

  private _setupCustomResetHandler(): void {
    const chart = this.chart();
    if (!chart) return;

    const originalReset = chart.resetSeries.bind(chart);
    chart.resetSeries = (): void => {
      const chartId = this.chartId();
      if (!chartId) {
        originalReset();
        return;
      }

      const initialState = this._effectiveInitialState();

      if (initialState) {
        // 1. Broadcast to sync service (for other charts)
        this._syncService.broadcastState({
          selectionEnd: null,
          selectionStart: null,
          xAxisMax: initialState.max,
          xAxisMin: initialState.min,
        });

        // 2. Use zoomX method to reset this chart instance
        if (chart.zoomX) {
          chart.zoomX(initialState.min, initialState.max);
        } else {
          // Fallback if zoomX is not available
          chart.updateOptions(
            {
              xaxis: {
                max: initialState.max,
                min: initialState.min,
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

  private _getDataLength(data: number[] | { [seriesName: string]: number[] }): number {
    if (Array.isArray(data)) {
      return data.length;
    }
    return Object.values(data)[0]?.length || 0;
  }
}
