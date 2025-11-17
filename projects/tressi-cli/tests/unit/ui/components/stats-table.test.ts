import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StatsTable } from '../../../../src/ui/components/stats-table';

// Mock blessed-contrib
const mockTableElement = {
  setData: vi.fn(),
  options: {
    columnWidth: [25, 20],
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

describe('StatsTable', () => {
  let statsTable: StatsTable;

  beforeEach(() => {
    vi.clearAllMocks();
    statsTable = new StatsTable(
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
          label: 'Live Stats',
          interactive: false,
          columnWidth: [25, 20],
        },
      );
    });
  });

  describe('update', () => {
    it('should update table with statistics data', () => {
      const headers = ['Metric', 'Value'];
      const data = [
        ['Total Requests', '1000'],
        ['Successful', '950'],
        ['Failed', '50'],
        ['Avg Latency', '150ms'],
        ['P95 Latency', '250ms'],
        ['P99 Latency', '350ms'],
      ];

      statsTable.update(headers, data);

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers,
        data: [
          ['Total Requests', '1000'],
          ['Successful', '950'],
          ['Failed', '50'],
          ['Avg Latency', '150ms'],
          ['P95 Latency', '250ms'],
          ['P99 Latency', '350ms'],
        ],
      });
    });

    it('should handle empty statistics', () => {
      statsTable.update(['Metric', 'Value'], []);

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers: ['Metric', 'Value'],
        data: [],
      });
    });
  });

  describe('updateFromObject', () => {
    it('should update table from object format', () => {
      const tableData = {
        headers: ['Metric', 'Value'],
        data: [
          ['Total Requests', '1000'],
          ['Successful', '950'],
        ],
      };

      statsTable.updateFromObject(tableData);

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers: tableData.headers,
        data: [
          ['Total Requests', '1000'],
          ['Successful', '950'],
        ],
      });
    });
  });

  describe('clear', () => {
    it('should clear table data', () => {
      statsTable.clear();

      expect(mockTableElement.setData).toHaveBeenCalledWith({
        headers: ['Stat', 'Value'],
        data: [],
      });
    });
  });

  describe('getElement', () => {
    it('should return the underlying table element', () => {
      const element = statsTable.getElement();
      expect(element).toBe(mockTableElement);
    });
  });
});
