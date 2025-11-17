import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResponseChart } from '../../../../src/ui/components/response-chart';

// Mock blessed-contrib
const mockLineElement = {
  setData: vi.fn(),
  options: {
    style: {
      line: 'yellow',
    },
  },
};

const mockGrid = {
  set: vi.fn().mockReturnValue(mockLineElement),
};

vi.mock('blessed-contrib', () => ({
  default: {
    line: vi.fn(),
  },
}));

describe('ResponseChart', () => {
  let responseChart: ResponseChart;

  beforeEach(() => {
    vi.clearAllMocks();
    responseChart = new ResponseChart(
      mockGrid as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      0,
      0,
      4,
      6,
    );
  });

  describe('constructor', () => {
    it('should create line chart with correct configuration', () => {
      expect(mockGrid.set).toHaveBeenCalledWith(
        0,
        0,
        4,
        6,
        expect.any(Function),
        {
          label: 'Response Codes Over Time',
          showLegend: false,
          valign: 'bottom',
          wholeNumbersOnly: true,
        },
      );
    });
  });

  describe('update', () => {
    it('should update chart with response time data', () => {
      const responseData = {
        success: [100, 150, 200, 120, 180],
        redirect: [0, 0, 0, 0, 0],
        clientError: [0, 0, 0, 0, 0],
        serverError: [0, 0, 0, 0, 0],
      };
      const timeLabels = ['00:00', '00:01', '00:02', '00:03', '00:04'];

      responseChart.update(responseData, timeLabels);

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: '2xx',
          x: timeLabels,
          y: [100, 150, 200, 120, 180],
          style: { line: 'green' },
        },
      ]);
    });

    it('should handle empty data', () => {
      const responseData = {
        success: [],
        redirect: [],
        clientError: [],
        serverError: [],
      };
      const timeLabels: string[] = [];

      responseChart.update(responseData, timeLabels);

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: '',
          x: [],
          y: [],
        },
      ]);
    });
  });

  describe('clear', () => {
    it('should clear chart data', () => {
      responseChart.clear();

      expect(mockLineElement.setData).toHaveBeenCalledWith([
        {
          title: '',
          x: [],
          y: [],
        },
      ]);
    });
  });

  describe('getElement', () => {
    it('should return the underlying line element', () => {
      const element = responseChart.getElement();
      expect(element).toBe(mockLineElement);
    });
  });
});
