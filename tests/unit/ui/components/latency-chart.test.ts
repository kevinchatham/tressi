import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LatencyChart } from '../../../../src/ui/components/latency-chart';

// Mock blessed-contrib
const mockLineElement = {
  setData: vi.fn(),
};

const mockGrid = {
  set: vi.fn().mockReturnValue(mockLineElement),
};

vi.mock('blessed-contrib', () => ({
  default: {
    line: vi.fn(),
  },
}));

describe('LatencyChart', () => {
  let latencyChart: LatencyChart;
  let grid: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    vi.clearAllMocks();
    grid = mockGrid;
    latencyChart = new LatencyChart(grid, 0, 0, 4, 6);
  });

  describe('constructor', () => {
    it('should create chart with correct configuration', () => {
      expect(grid.set).toHaveBeenCalledWith(0, 0, 4, 6, expect.any(Function), {
        label: 'Avg Latency (ms)',
        showLegend: false,
        maxY: 1000,
        valign: 'bottom',
      });
    });
  });

  describe('update', () => {
    it('should update chart with latency data and time labels', () => {
      const latencyData = [100, 150, 200, 175];
      const timeLabels = ['0s', '5s', '10s', '15s'];

      latencyChart.update(latencyData, timeLabels);

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: 'Latency',
          x: timeLabels,
          y: [100, 150, 200, 175],
        },
      ]);
    });

    it('should handle empty latency data', () => {
      const latencyData: number[] = [];
      const timeLabels: string[] = [];

      latencyChart.update(latencyData, timeLabels);

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: 'Latency',
          x: [],
          y: [],
        },
      ]);
    });

    it('should round latency values to integers', () => {
      const latencyData = [100.7, 150.3, 200.9];
      const timeLabels = ['0s', '5s', '10s'];

      latencyChart.update(latencyData, timeLabels);

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: 'Latency',
          x: timeLabels,
          y: [101, 150, 201],
        },
      ]);
    });
  });

  describe('getData', () => {
    it('should return current historical data', () => {
      const latencyData = [100, 150, 200];
      const timeLabels = ['0s', '5s', '10s'];

      latencyChart.update(latencyData, timeLabels);
      const data = latencyChart.getData();

      expect(data).toEqual([100, 150, 200]);
    });

    it('should return a copy of the data', () => {
      const latencyData = [100, 150, 200];
      const timeLabels = ['0s', '5s', '10s'];

      latencyChart.update(latencyData, timeLabels);
      const data1 = latencyChart.getData();
      const data2 = latencyChart.getData();

      expect(data1).toEqual(data2);
      expect(data1).not.toBe(data2);
    });
  });

  describe('clear', () => {
    it('should clear chart data', () => {
      const latencyData = [100, 150, 200];
      const timeLabels = ['0s', '5s', '10s'];

      latencyChart.update(latencyData, timeLabels);
      latencyChart.clear();

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: 'Latency',
          x: [],
          y: [],
        },
      ]);
      expect(latencyChart.getData()).toEqual([]);
    });
  });

  describe('getElement', () => {
    it('should return the underlying chart element', () => {
      const element = latencyChart.getElement();
      expect(element).toBe(mockLineElement);
    });
  });
});
