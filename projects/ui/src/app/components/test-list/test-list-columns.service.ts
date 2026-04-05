import { Injectable, inject, linkedSignal, signal } from '@angular/core';
import { type ColumnConfig, ColumnKey, type SortConfig } from '@tressi/shared/ui';

import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { DEFAULT_COLUMN_CONFIGS } from './column-config.constants';

@Injectable({ providedIn: 'root' })
export class TestListColumnsService {
  private readonly _logService = inject(LogService);
  private readonly _localStorageService = inject(LocalStorageService);

  private readonly _defaultColumns: ColumnConfig[] = DEFAULT_COLUMN_CONFIGS;
  private readonly _sortConfig = signal<SortConfig | null>(null);

  private readonly _columns = signal<ColumnConfig[]>(this._loadColumnPreferences());

  /**
   * Computed signal that returns the visible columns in the correct order.
   * Fixed columns (select and status) are always included at the beginning,
   * followed by configurable visible columns sorted by their order property.
   */
  readonly visibleColumns = linkedSignal({
    computation: (columns: ColumnConfig[]) => {
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
    source: this._columns,
  });

  /**
   * Computed signal that groups columns by their group type (basic, performance, advanced).
   * Excludes action, status, and select columns from grouping.
   */
  readonly columnGroups = linkedSignal({
    computation: (columns: ColumnConfig[]) => {
      const groups: Record<string, ColumnConfig[]> = {
        basic: [],
        configuration: [],
        latency: [],
        network: [],
        performance: [],
        request: [],
      };
      columns.forEach((col) => {
        if (col.key !== 'actions' && col.key !== ColumnKey.STATUS && col.key !== ColumnKey.SELECT) {
          groups[col.group]?.push(col);
        }
      });
      return groups;
    },
    source: this._columns,
  });

  /**
   * Current sort configuration
   */
  readonly currentSort = this._sortConfig.asReadonly();

  /**
   * Loads column preferences from local storage and merges them with default configurations.
   * @returns Array of column configurations with applied preferences
   */
  private _loadColumnPreferences(): ColumnConfig[] {
    try {
      const preferences = this._localStorageService.preferences();
      const savedColumns = preferences.columnPreferences;

      if (savedColumns && savedColumns.length > 0) {
        // Merge with defaults to handle new columns
        return this._defaultColumns.map((defaultCol) => {
          const saved = savedColumns.find((col) => col.key === defaultCol.key);
          return saved ? { ...defaultCol, ...saved } : defaultCol;
        });
      }
    } catch (error) {
      this._logService.error('Failed to load column preferences:', error);
    }
    return this._defaultColumns;
  }

  /**
   * Saves current column preferences to local storage.
   */
  private _saveColumnPreferences(): void {
    try {
      const preferences = this._localStorageService.preferences();
      const updatedPreferences = {
        ...preferences,
        columnPreferences: this._columns(),
      };
      this._localStorageService.savePreferences(updatedPreferences);
    } catch (error) {
      this._logService.error('Failed to save column preferences:', error);
    }
  }

  /**
   * Toggles the visibility of a column by its key.
   * @param key - The column key to toggle
   */
  toggleColumn(key: string): void {
    this._columns.update((cols) =>
      cols.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col)),
    );
    this._saveColumnPreferences();
  }

  /**
   * Reorders columns by moving a dragged column to a target position.
   * @param draggedKey - The key of the column being dragged
   * @param targetKey - The key of the target column position
   */
  reorderColumn(draggedKey: string, targetKey: string): void {
    this._columns.update((cols) => {
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

    this._saveColumnPreferences();
  }

  /**
   * Updates the width of a specific column.
   * @param key - The column key to update
   * @param width - The new width in pixels
   */
  updateColumnWidth(key: string, width: number): void {
    this._columns.update((cols) => cols.map((col) => (col.key === key ? { ...col, width } : col)));
    this._saveColumnPreferences();
  }

  /**
   * Updates the sort configuration for a column.
   * @param columnKey - The key of the column to sort by
   * @param direction - The sort direction ('asc' | 'desc' | null)
   */
  updateSort(columnKey: string, direction: 'asc' | 'desc' | null): void {
    if (direction === null) {
      this._sortConfig.set(null);
    } else {
      this._sortConfig.set({ columnKey, direction });
    }
  }

  /**
   * Toggles sort direction for a column (asc -> desc -> asc).
   * @param columnKey - The key of the column to toggle sort for
   */
  toggleSort(columnKey: string): void {
    const current = this._sortConfig();
    if (current?.columnKey !== columnKey) {
      this._sortConfig.set({ columnKey, direction: 'asc' });
    } else {
      this._sortConfig.set({
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
    return this._columns().filter((col) => col.sortable !== false);
  }

  /**
   * Resets all columns to their default configuration.
   */
  resetColumns(): void {
    this._columns.set(this._defaultColumns);
    this._sortConfig.set(null);
    this._saveColumnPreferences();
  }
}
