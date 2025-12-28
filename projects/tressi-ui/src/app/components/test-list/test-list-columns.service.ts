import { inject, Injectable, linkedSignal, signal } from '@angular/core';

import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { DEFAULT_COLUMN_CONFIGS } from './column-config.constants';
import { ColumnKey } from './column-keys.enum';

export interface ColumnConfig {
  key: string;
  label: string;
  field: string;
  format?: 'number' | 'percentage' | 'milliseconds' | 'datetime' | 'duration';
  visible: boolean;
  group: 'basic' | 'performance' | 'advanced';
  sortable?: boolean;
  order: number; // 0-based position in table
  draggable?: boolean; // whether column can be reordered
  width?: number; // column width in pixels
}

export interface SortConfig {
  columnKey: string;
  direction: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class TestListColumnsService {
  private readonly logService = inject(LogService);
  private readonly localStorageService = inject(LocalStorageService);

  private readonly DEFAULT_COLUMNS: ColumnConfig[] = DEFAULT_COLUMN_CONFIGS;
  private readonly sortConfig = signal<SortConfig | null>(null);

  private readonly columns = signal<ColumnConfig[]>(
    this.loadColumnPreferences(),
  );

  /**
   * Computed signal that returns the visible columns in the correct order.
   * Fixed columns (select and status) are always included at the beginning,
   * followed by configurable visible columns sorted by their order property.
   */
  readonly visibleColumns = linkedSignal({
    source: this.columns,
    computation: (columns) => {
      const allColumns = columns;
      const fixedColumns = allColumns.filter(
        (col) => col.key === ColumnKey.SELECT || col.key === ColumnKey.STATUS,
      );
      const configurableColumns = allColumns
        .filter(
          (col) =>
            col.key !== ColumnKey.SELECT &&
            col.key !== ColumnKey.STATUS &&
            col.key !== 'actions' &&
            col.visible,
        )
        .sort((a, b) => a.order - b.order); // Sort by order

      return [...fixedColumns, ...configurableColumns];
    },
  });

  /**
   * Computed signal that groups columns by their group type (basic, performance, advanced).
   * Excludes action, status, and select columns from grouping.
   */
  readonly columnGroups = linkedSignal({
    source: this.columns,
    computation: (columns) => {
      const groups: Record<string, ColumnConfig[]> = {
        basic: [],
        performance: [],
        advanced: [],
      };
      columns.forEach((col) => {
        if (
          col.key !== 'actions' &&
          col.key !== ColumnKey.STATUS &&
          col.key !== ColumnKey.SELECT
        ) {
          groups[col.group]?.push(col);
        }
      });
      return groups;
    },
  });

  /**
   * Current sort configuration
   */
  readonly currentSort = this.sortConfig.asReadonly();

  /**
   * Loads column preferences from local storage and merges them with default configurations.
   * @returns Array of column configurations with applied preferences
   */
  private loadColumnPreferences(): ColumnConfig[] {
    try {
      const preferences = this.localStorageService.getPreferences();
      const savedColumns = preferences.columnPreferences;

      if (savedColumns && savedColumns.length > 0) {
        // Merge with defaults to handle new columns
        return this.DEFAULT_COLUMNS.map((defaultCol) => {
          const saved = savedColumns.find((col) => col.key === defaultCol.key);
          return saved ? { ...defaultCol, ...saved } : defaultCol;
        });
      }
    } catch (error) {
      this.logService.error('Failed to load column preferences:', error);
    }
    return this.DEFAULT_COLUMNS;
  }

  /**
   * Saves current column preferences to local storage.
   */
  private saveColumnPreferences(): void {
    try {
      const preferences = this.localStorageService.getPreferences();
      const updatedPreferences = {
        ...preferences,
        columnPreferences: this.columns(),
      };
      this.localStorageService.savePreferences(updatedPreferences);
    } catch (error) {
      this.logService.error('Failed to save column preferences:', error);
    }
  }

  /**
   * Toggles the visibility of a column by its key.
   * @param key - The column key to toggle
   */
  toggleColumn(key: string): void {
    this.columns.update((cols) =>
      cols.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col,
      ),
    );
    this.saveColumnPreferences();
  }

  /**
   * Reorders columns by moving a dragged column to a target position.
   * @param draggedKey - The key of the column being dragged
   * @param targetKey - The key of the target column position
   */
  reorderColumn(draggedKey: string, targetKey: string): void {
    this.columns.update((cols) => {
      const draggedIndex = cols.findIndex((col) => col.key === draggedKey);
      const targetIndex = cols.findIndex((col) => col.key === targetKey);

      if (draggedIndex === -1 || targetIndex === -1) return cols;

      // Prevent reordering fixed columns
      if (!cols[draggedIndex].draggable || !cols[targetIndex].draggable) {
        return cols;
      }

      const newColumns = [...cols];
      const [draggedColumn] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, draggedColumn);

      // Recalculate order values
      return newColumns.map((col, index) => ({
        ...col,
        order: index,
      }));
    });

    this.saveColumnPreferences();
  }

  /**
   * Updates the width of a specific column.
   * @param key - The column key to update
   * @param width - The new width in pixels
   */
  updateColumnWidth(key: string, width: number): void {
    this.columns.update((cols) =>
      cols.map((col) => (col.key === key ? { ...col, width } : col)),
    );
    this.saveColumnPreferences();
  }

  /**
   * Updates the sort configuration for a column.
   * @param columnKey - The key of the column to sort by
   * @param direction - The sort direction ('asc' | 'desc' | null)
   */
  updateSort(columnKey: string, direction: 'asc' | 'desc' | null): void {
    if (direction === null) {
      this.sortConfig.set(null);
    } else {
      this.sortConfig.set({ columnKey, direction });
    }
  }

  /**
   * Toggles sort direction for a column (asc -> desc -> asc).
   * @param columnKey - The key of the column to toggle sort for
   */
  toggleSort(columnKey: string): void {
    const current = this.sortConfig();
    if (!current || current.columnKey !== columnKey) {
      this.sortConfig.set({ columnKey, direction: 'asc' });
    } else {
      this.sortConfig.set({
        columnKey,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      });
    }
  }

  /**
   * Gets the sortable columns that can be used for sorting.
   * @returns Array of columns that support sorting
   */
  getSortableColumns(): ColumnConfig[] {
    return this.columns().filter((col) => col.sortable !== false);
  }

  /**
   * Resets all columns to their default configuration.
   */
  resetColumns(): void {
    this.columns.set(this.DEFAULT_COLUMNS);
    this.sortConfig.set(null);
    this.saveColumnPreferences();
  }
}
