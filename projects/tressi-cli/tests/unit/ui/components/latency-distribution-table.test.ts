import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LatencyDistributionTable } from '../../../../src/ui/components/latency-distribution-table';

// Mock blessed-contrib
const mockTableElement = {
  setData: vi.fn(),
  options: {
    columnWidth: [15, 10, 15, 15],
    columnSpacing: 1,
  },
};

const mockGrid = {
  set: vi.fn().mockReturnValue(mockTableElement),
};

vi.mock('blessed-contrib', () => ({
  default: {
    table: vi.fn(),
  },
}));

describe('LatencyDistributionTable', () => {
  let latencyDistributionTable: LatencyDistributionTable;

  beforeEach(() => {
    vi.clearAllMocks();
    latencyDistributionTable = new LatencyDistributionTable(
      mockGrid as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      0,
      0,
      4,
      6,
    );
  });

  describe('constructor', () => {
    it('should create table with correct configuration', () => {
      expect(mockGrid.set).toHaveBeenCalledWith(
        0,
        0,
        4,
        6,
        expect.any(Function),
        {
          label: 'Latency Distribution (ms)',
          interactive: false,
          columnSpacing: 1,
          columnWidth: [15, 10, 15, 15],
        },
      );
    });
  });

  describe('update', () => {
    it('should update table with headers and data', () => {
      const headers = ['Range', 'Count', '% of Total', 'Cumulative'];
      const data = [
        ['0-50ms', '500', '50%', '50%'],
        ['50-100ms', '300', '30%', '80%'],
        ['100-200ms', '200', '20%', '100%'],
      ];

      latencyDistributionTable.update(headers, data);

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers,
        data: [
          ['0-50ms', '500', '50%', '50%'],
          ['50-100ms', '300', '30%', '80%'],
          ['100-200ms', '200', '20%', '100%'],
        ],
      });
    });

    it('should convert all cell values to strings', () => {
      const headers = ['Range', 'Count', 'Percentage'];
      const data = [
        ['0-50ms', 500, 50.5],
        ['50-100ms', 300, 30.0],
      ];

      latencyDistributionTable.update(headers, data as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers,
        data: [
          ['0-50ms', '500', '50.5'],
          ['50-100ms', '300', '30'],
        ],
      });
    });
  });

  describe('updateFromObject', () => {
    it('should update table from object format', () => {
      const tableData = {
        headers: ['Range', 'Count', '% of Total'],
        data: [
          ['0-50ms', '500', '50%'],
          ['50-100ms', '300', '30%'],
        ],
      };

      latencyDistributionTable.updateFromObject(tableData);

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers: tableData.headers,
        data: [
          ['0-50ms', '500', '50%'],
          ['50-100ms', '300', '30%'],
        ],
      });
    });
  });

  describe('clear', () => {
    it('should clear table data with default headers', () => {
      latencyDistributionTable.clear();

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers: ['Range', 'Count', '% of Total', 'Cumulative'],
        data: [],
      });
    });
  });

  describe('getElement', () => {
    it('should return the underlying table element', () => {
      const element = latencyDistributionTable.getElement();
      expect(element).toBe(mockTableElement);
    });
  });

  describe('setColumnWidths', () => {
    it('should update column widths', () => {
      const newWidths = [20, 15, 20, 20];

      latencyDistributionTable.setColumnWidths(newWidths);

      expect(mockTableElement.options.columnWidth).toEqual(newWidths);
    });
  });

  describe('setColumnSpacing', () => {
    it('should update column spacing', () => {
      const newSpacing = 2;

      latencyDistributionTable.setColumnSpacing(newSpacing);

      expect(mockTableElement.options.columnSpacing).toEqual(newSpacing);
    });
  });
});
