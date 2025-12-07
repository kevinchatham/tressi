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

  readonly chartClick = output<ChartEventData>();
  readonly chartMouseMove = output<ChartEventData>();

  private readonly themeService = inject(ThemeService);

  public readonly chartOptions = computed(() => this.createChartOptions());

  constructor() {
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
        // animations: {
        //   enabled: true,
        //   speed: 100,
        //   dynamicAnimation: {
        //     speed: 100,
        //   },
        // },
        background: themeColors.background,
        foreColor: themeColors.text,
        events: {
          click: (event, chartContext, config): void => {
            this.chartClick.emit({ event, chartContext, config });
          },
          mouseMove: (event, chartContext, config): void => {
            this.chartMouseMove.emit({ event, chartContext, config });
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
        labels: {
          show: data.length > 1,
          style: {
            colors: themeColors.text,
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
          },
        },
        labels: {
          style: {
            colors: themeColors.text,
          },
          formatter: (value: number): string => {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'K';
            } else if (value >= 100) {
              return value.toFixed(1);
            } else if (value >= 10) {
              return value.toFixed(2);
            } else if (value >= 1) {
              return value.toFixed(2);
            } else {
              return value.toFixed(3);
            }
          },
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

  private updateChart(): void {
    const seriesName = this.seriesName();
    const data = this.data();
    const labels = this.labels();
    const title = this.title();
    const yAxisLabel = this.yAxisLabel();

    const chart = this.chart();

    if (!chart) return;

    // Convert data and labels to proper format for datetime chart
    const seriesData = data.map((value, index) => ({
      x: labels[index] || Date.now() - (data.length - 1 - index) * 1000,
      y: value,
    }));

    chart.updateSeries(
      [
        {
          name: seriesName,
          data: seriesData,
        },
      ],
      true,
    );

    chart.updateOptions(
      {
        title: {
          text: title,
        },
        yaxis: {
          title: {
            text: yAxisLabel,
          },
        },
      },
      false,
      false,
    );
  }
}
