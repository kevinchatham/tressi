import { computed, inject, Injectable, signal } from '@angular/core';

import { LogService } from '../../services/log.service';

export interface ColumnConfig {
  key: string;
  label: string;
  field: string;
  format?: 'number' | 'percentage' | 'milliseconds' | 'datetime' | 'duration';
  visible: boolean;
  group: 'basic' | 'performance' | 'advanced';
  sortable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TestListColumnsService {
  private readonly logService = inject(LogService);

  private readonly DEFAULT_COLUMNS: ColumnConfig[] = [
    // Selection column (always visible)
    {
      key: 'select',
      label: 'Select',
      field: 'select',
      visible: true,
      group: 'basic',
    },
    // Basic columns (always visible by default)
    {
      key: 'status',
      label: 'Status',
      field: 'test.status',
      visible: true,
      group: 'basic',
    },
    {
      key: 'startTime',
      label: 'Start Time',
      field: 'test.epochStartedAt',
      format: 'datetime',
      visible: true,
      group: 'basic',
    },
    {
      key: 'duration',
      label: 'Duration',
      field: 'test.duration',
      format: 'duration',
      visible: true,
      group: 'basic',
    },
    {
      key: 'requests',
      label: 'Requests',
      field: 'summary.global.totalRequests',
      format: 'number',
      visible: true,
      group: 'basic',
    },
    {
      key: 'errorRate',
      label: 'Error Rate',
      field: 'summary.global.errorRate',
      format: 'percentage',
      visible: true,
      group: 'basic',
    },

    // Performance columns (optional)
    {
      key: 'successfulRequests',
      label: 'Successful',
      field: 'summary.global.successfulRequests',
      format: 'number',
      visible: false,
      group: 'performance',
    },
    {
      key: 'failedRequests',
      label: 'Failed',
      field: 'summary.global.failedRequests',
      format: 'number',
      visible: false,
      group: 'performance',
    },
    {
      key: 'avgLatency',
      label: 'Avg Latency',
      field: 'summary.global.averageLatency',
      format: 'milliseconds',
      visible: false,
      group: 'performance',
    },
    {
      key: 'p95Latency',
      label: 'P95 Latency',
      field: 'summary.global.p95Latency',
      format: 'milliseconds',
      visible: false,
      group: 'performance',
    },
    {
      key: 'p99Latency',
      label: 'P99 Latency',
      field: 'summary.global.p99Latency',
      format: 'milliseconds',
      visible: false,
      group: 'performance',
    },
    {
      key: 'actualRps',
      label: 'Actual RPS',
      field: 'summary.global.requestsPerSecond',
      format: 'number',
      visible: false,
      group: 'performance',
    },
    {
      key: 'achievedPercentage',
      label: 'Achieved %',
      field: 'summary.global.achievedPercentage',
      format: 'percentage',
      visible: false,
      group: 'performance',
    },

    // Advanced columns
    {
      key: 'tressiVersion',
      label: 'Version',
      field: 'summary.tressiVersion',
      visible: false,
      group: 'advanced',
    },
    {
      key: 'minLatency',
      label: 'Min Latency',
      field: 'summary.global.minLatency',
      format: 'milliseconds',
      visible: false,
      group: 'advanced',
    },
    {
      key: 'maxLatency',
      label: 'Max Latency',
      field: 'summary.global.maxLatency',
      format: 'milliseconds',
      visible: false,
      group: 'advanced',
    },
    {
      key: 'theoreticalMaxRps',
      label: 'Max RPS',
      field: 'summary.global.theoreticalMaxRps',
      format: 'number',
      visible: false,
      group: 'advanced',
    },
  ];

  private readonly columns = signal<ColumnConfig[]>(
    this.loadColumnPreferences(),
  );

  readonly visibleColumns = computed(() => {
    const allColumns = this.columns();
    const fixedColumns = allColumns.filter(
      (col) => col.key === 'select' || col.key === 'status',
    );
    const configurableColumns = allColumns.filter(
      (col) =>
        col.key !== 'select' &&
        col.key !== 'status' &&
        col.key !== 'actions' &&
        col.visible,
    );
    return [...fixedColumns, ...configurableColumns];
  });

  readonly columnGroups = computed(() => {
    const groups: Record<string, ColumnConfig[]> = {
      basic: [],
      performance: [],
      advanced: [],
    };
    this.columns().forEach((col) => {
      if (
        col.key !== 'actions' &&
        col.key !== 'status' &&
        col.key !== 'select'
      ) {
        groups[col.group]?.push(col);
      }
    });
    return groups;
  });

  private loadColumnPreferences(): ColumnConfig[] {
    try {
      const saved = localStorage.getItem('test-list-columns');
      if (saved) {
        const savedColumns = JSON.parse(saved) as ColumnConfig[];
        // Merge with defaults to handle new columns
        return this.DEFAULT_COLUMNS.map((defaultCol) => {
          const saved = savedColumns.find((col) => col.key === defaultCol.key);
          return saved ? { ...defaultCol, visible: saved.visible } : defaultCol;
        });
      }
    } catch (error) {
      this.logService.error('Failed to load column preferences:', error);
    }
    return this.DEFAULT_COLUMNS;
  }

  private saveColumnPreferences(): void {
    try {
      localStorage.setItem('test-list-columns', JSON.stringify(this.columns()));
    } catch (error) {
      this.logService.error('Failed to save column preferences:', error);
    }
  }

  toggleColumn(key: string): void {
    this.columns.update((cols) =>
      cols.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col,
      ),
    );
    this.saveColumnPreferences();
  }

  resetColumns(): void {
    this.columns.set(this.DEFAULT_COLUMNS);
    this.saveColumnPreferences();
  }

  getColumns(): ColumnConfig[] {
    return this.columns();
  }
}
