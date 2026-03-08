import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartSyncState } from '@tressi/shared/ui';
import { ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartSyncService } from '../../services/chart-sync.service';
import { ThemeService } from '../../services/theme.service';
import { LineChartComponent } from './line-chart.component';

@Component({
  selector: 'apx-chart',
  standalone: true,
  template: '',
})
class MockChartComponent {
  series: unknown = input();
  chart: unknown = input();
  xaxis: unknown = input();
  stroke: unknown = input();
  dataLabels: unknown = input();
  grid: unknown = input();
  title: unknown = input();
  yaxis: unknown = input();
  markers: unknown = input();

  zoomX = vi.fn();
  updateOptions = vi.fn();
  updateSeries = vi.fn();
  resetSeries = vi.fn();
}

describe('LineChartComponent', () => {
  let component: LineChartComponent;
  let fixture: ComponentFixture<LineChartComponent>;

  const themeServiceMock = {
    getChartColors: vi.fn().mockReturnValue({
      primary: '#000',
      secondary: '#111',
      background: '#222',
      grid: '#333',
      text: '#444',
      border: '#555',
    }),
  };

  const syncServiceMock = {
    lastInteractedChartId: vi.fn().mockReturnValue(null),
    registerChart: vi.fn(),
    setAsMaster: vi.fn(),
    broadcastState: vi.fn(),
    getState: vi.fn().mockReturnValue({
      xAxisMin: null,
      xAxisMax: null,
      selectionStart: null,
      selectionEnd: null,
      lastInteractedChartId: null,
    } as ChartSyncState),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LineChartComponent],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: ChartSyncService, useValue: syncServiceMock },
      ],
    })
      .overrideComponent(LineChartComponent, {
        remove: { imports: [NgApexchartsModule] },
        add: { imports: [MockChartComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LineChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register chart if chartId is provided', () => {
    fixture.componentRef.setInput('chartId', 'test-chart');
    fixture.detectChanges();
    expect(syncServiceMock.registerChart).toHaveBeenCalledWith('test-chart');
  });

  it('should generate correct chart options for single series data', () => {
    fixture.componentRef.setInput('data', [10, 20, 30]);
    fixture.componentRef.setInput('labels', [1000, 2000, 3000]);
    fixture.componentRef.setInput('seriesName', 'Test Series');
    fixture.detectChanges();

    const options = component.chartOptions();
    expect(options.series).toHaveLength(1);
    const series = options.series?.[0] as {
      name: string;
      data: { x: number; y: number }[];
    };
    expect(series.name).toBe('Test Series');
    expect(series.data).toEqual([
      { x: 1000, y: 10 },
      { x: 2000, y: 20 },
      { x: 3000, y: 30 },
    ]);
  });

  it('should generate correct chart options for multi-series data', () => {
    fixture.componentRef.setInput('data', {
      SeriesA: [10, 20],
      SeriesB: [30, 40],
    });
    fixture.componentRef.setInput('labels', [1000, 2000]);
    fixture.detectChanges();

    const options = component.chartOptions();
    expect(options.series).toHaveLength(2);

    const seriesA = options.series?.find((s) => s.name === 'SeriesA') as {
      data: { x: number; y: number }[];
    };
    const seriesB = options.series?.find((s) => s.name === 'SeriesB') as {
      data: { x: number; y: number }[];
    };

    expect(seriesA.data).toEqual([
      { x: 1000, y: 10 },
      { x: 2000, y: 20 },
    ]);
    expect(seriesB.data).toEqual([
      { x: 1000, y: 30 },
      { x: 2000, y: 40 },
    ]);
  });

  it('should handle chart click and set as master', () => {
    fixture.componentRef.setInput('chartId', 'test-chart');
    fixture.detectChanges();

    const options = component.chartOptions();
    const clickHandler = options.chart?.events?.click;
    clickHandler?.({} as MouseEvent, {} as ChartComponent, {});
    expect(syncServiceMock.setAsMaster).toHaveBeenCalledWith('test-chart');
  });

  it('should handle zoom and broadcast state', () => {
    fixture.componentRef.setInput('chartId', 'test-chart');
    fixture.detectChanges();

    const options = component.chartOptions();
    options.chart?.events?.zoomed?.({} as ChartComponent, {
      xaxis: { min: 100, max: 200 },
    });

    expect(syncServiceMock.setAsMaster).toHaveBeenCalledWith('test-chart');
    expect(syncServiceMock.broadcastState).toHaveBeenCalledWith({
      xAxisMin: 100,
      xAxisMax: 200,
      selectionStart: null,
      selectionEnd: null,
    });
  });

  it('should handle selection and broadcast state', () => {
    fixture.componentRef.setInput('chartId', 'test-chart');
    fixture.detectChanges();

    const options = component.chartOptions();
    options.chart?.events?.selection?.({} as ChartComponent, {
      xaxis: { min: 150, max: 250 },
    });

    expect(syncServiceMock.setAsMaster).toHaveBeenCalledWith('test-chart');
    expect(syncServiceMock.broadcastState).toHaveBeenCalledWith({
      selectionStart: 150,
      selectionEnd: 250,
      xAxisMin: null,
      xAxisMax: null,
    });
  });

  it('should sync to master state when not the master chart', async () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('chartId', 'slave-chart');
    syncServiceMock.lastInteractedChartId.mockReturnValue('master-chart');
    syncServiceMock.getState.mockReturnValue({
      xAxisMin: 500,
      xAxisMax: 600,
      selectionStart: null,
      selectionEnd: null,
      lastInteractedChartId: 'master-chart',
    });

    fixture.detectChanges();

    const mockChart = component.chart() as unknown as MockChartComponent;
    expect(mockChart).toBeTruthy();

    vi.advanceTimersByTime(100);
    expect(mockChart.zoomX).toHaveBeenCalledWith(500, 600);
    vi.useRealTimers();
  });

  it('should update series when data changes', async () => {
    fixture.componentRef.setInput('data', [1, 2, 3]);
    fixture.detectChanges();

    const mockChart = component.chart() as unknown as MockChartComponent;

    fixture.componentRef.setInput('data', [1, 2, 3, 4]);
    fixture.detectChanges();

    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(mockChart.updateSeries).toHaveBeenCalled();
  });

  it('should use custom reset handler', () => {
    fixture.componentRef.setInput('chartId', 'test-chart');
    fixture.componentRef.setInput('labels', [100, 200, 300]);
    fixture.detectChanges();

    const mockChart = component.chart() as unknown as MockChartComponent;
    expect(mockChart.resetSeries).not.toBeUndefined();

    mockChart.resetSeries();
    expect(syncServiceMock.broadcastState).toHaveBeenCalledWith({
      xAxisMin: 100,
      xAxisMax: 300,
      selectionStart: null,
      selectionEnd: null,
    });
    expect(mockChart.zoomX).toHaveBeenCalledWith(100, 300);
  });
});
