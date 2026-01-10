import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, input, output } from '@angular/core';

import { ColumnConfig } from '../../../services/local-storage.service';
import type { TestDocument } from '../../../services/rpc.service';
import { TestService } from '../../../services/test.service';
import { IconComponent, IconName } from '../../icon/icon.component';
import { StatusBadgeComponent } from '../../status-badge/status-badge.component';
import { ColumnKey, FieldPath } from '../column-keys.enum';
import type { SortConfig } from '../test-list-columns.service';

// Define extractor function type
type ValueExtractor = (test: TestDocument) => string;

@Component({
  selector: 'app-test-table',
  standalone: true,
  imports: [IconComponent, DragDropModule, StatusBadgeComponent],
  templateUrl: './test-table.component.html',
})
export class TestTableComponent {
  tests = input.required<TestDocument[]>();
  columns = input.required<ColumnConfig[]>();
  selectedTests = input.required<Set<string>>();
  isAllSelected = input.required<boolean>();
  isSomeSelected = input.required<boolean>();
  currentSort = input<SortConfig | null>(null);

  viewTest = output<string>();
  toggleSelection = output<{ testId: string; event: Event }>();
  toggleAllSelection = output<Event>();
  columnReorder = output<{ draggedKey: string; targetKey: string }>();
  columnSort = output<string>();

  private readonly testService = inject(TestService);

  // Create complete mapping that TypeScript will type-check
  private readonly VALUE_EXTRACTORS: Record<FieldPath, ValueExtractor> = {
    select: () => '',
    'test.status': (test) => test.status || 'unknown',
    'test.epochStartedAt': (test) =>
      this.formatDate(
        test.summary?.global.epochStartedAt || test.epochCreatedAt,
      ),
    'test.duration': (test) => this.getTestDuration(test),
    'summary.global.totalRequests': (test) => {
      if (!test.summary) return '—';
      return test.summary.global.totalRequests.toLocaleString();
    },
    'summary.global.successfulRequests': (test) => {
      if (!test.summary) return '—';
      return test.summary.global.successfulRequests.toLocaleString();
    },
    'summary.global.failedRequests': (test) => {
      if (!test.summary) return '—';
      return test.summary.global.failedRequests.toLocaleString();
    },
    'summary.global.p50LatencyMs': (test) => {
      if (!test.summary) return '—';
      return `${test.summary.global.p50LatencyMs}ms`;
    },
    'summary.global.p95LatencyMs': (test) => {
      if (!test.summary) return '—';
      return `${test.summary.global.p95LatencyMs}ms`;
    },
    'summary.global.p99LatencyMs': (test) => {
      if (!test.summary) return '—';
      return `${test.summary.global.p99LatencyMs}ms`;
    },
    'summary.tressiVersion': (test) => {
      if (!test.summary) return '—';
      return test.summary.tressiVersion;
    },
    'summary.global.minLatencyMs': (test) => {
      if (!test.summary) return '—';
      return `${test.summary.global.minLatencyMs}ms`;
    },
    'summary.global.maxLatencyMs': (test) => {
      if (!test.summary) return '—';
      return `${test.summary.global.maxLatencyMs}ms`;
    },
    'summary.global.epochStartedAt': (test) => {
      if (!test.summary) return '—';
      return this.formatDate(test.summary.global.epochStartedAt);
    },
    'summary.global.epochEndedAt': (test) => {
      if (!test.summary) return '—';
      return this.formatDate(test.summary.global.epochEndedAt);
    },
  };

  getColumnValue(test: TestDocument, column: ColumnConfig): string {
    // Handle special 'select' column which doesn't extract data
    if (column.field === 'select') {
      return '';
    }

    const extractor = this.VALUE_EXTRACTORS[column.field];
    if (!extractor) {
      return '—'; // This should never happen with proper typing
    }
    return extractor(test);
  }

  getTestDuration(test: TestDocument): string {
    // Use embedded summary duration first
    if (test.summary?.global.finalDurationSec) {
      return this.testService.formatDuration(
        test.summary.global.finalDurationSec * 1000,
      );
    }

    // Fallback to timestamp calculation using embedded summary fields
    if (
      test.status === 'completed' &&
      test.summary?.global.epochStartedAt &&
      test.summary?.global.epochEndedAt
    ) {
      const duration =
        test.summary.global.epochEndedAt - test.summary.global.epochStartedAt;
      return this.testService.formatDuration(duration);
    }

    return this.testService.formatDuration(
      this.testService.getTestDuration(test),
    );
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  calculateErrorRate(test: TestDocument): string {
    // Use embedded summary
    if (test.summary) {
      const { global: g } = test.summary;
      const errorRate = (g.failedRequests / g.totalRequests) * 100;
      return `${errorRate}%`;
    }

    // Failed tests without summary
    if (test.status === 'failed') {
      return '100.00%';
    }
    return test.error ? 'Error' : '0.00%';
  }

  getRequestCount(test: TestDocument): string {
    // Use embedded summary
    if (test.summary) {
      return test.summary.global.totalRequests.toLocaleString();
    }
    return '0';
  }

  onViewTest(testId: string): void {
    this.viewTest.emit(testId);
  }

  onToggleSelection(testId: string, event: Event): void {
    this.toggleSelection.emit({ testId, event });
  }

  onToggleAllSelection(event: Event): void {
    this.toggleAllSelection.emit(event);
  }

  onHeaderDragDrop(event: CdkDragDrop<ColumnConfig[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const columns = this.columns();
    const draggedColumn = columns[event.previousIndex];
    const targetColumn = columns[event.currentIndex];

    // Prevent reordering fixed columns
    if (!draggedColumn.draggable || !targetColumn.draggable) return;

    this.columnReorder.emit({
      draggedKey: draggedColumn.key,
      targetKey: targetColumn.key,
    });
  }

  onColumnHeaderClick(column: ColumnConfig): void {
    if (column.sortable !== false && column.key !== ColumnKey.SELECT) {
      this.columnSort.emit(column.key);
    }
  }

  getSortIcon(columnKey: string): IconName | null {
    const sort = this.currentSort();
    if (!sort || sort.columnKey !== columnKey) {
      return null; // No icon for unsorted columns (matches original behavior)
    }
    return sort.direction === 'asc'
      ? 'keyboard_arrow_up'
      : 'keyboard_arrow_down';
  }

  isColumnSorted(columnKey: string): boolean {
    return this.currentSort()?.columnKey === columnKey;
  }
}
