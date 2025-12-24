import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';

import type { TestDocument } from '../../../services/rpc.service';
import { TestService } from '../../../services/test.service';
import { IconComponent, IconName } from '../../icon/icon.component';
import { ColumnKey } from '../column-keys.enum';
import type { ColumnConfig, SortConfig } from '../test-list-columns.service';

@Component({
  selector: 'app-test-table',
  standalone: true,
  imports: [CommonModule, IconComponent, DragDropModule],
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

  getColumnValue(test: TestDocument, column: ColumnConfig): string {
    // Handle basic test fields
    switch (column.field) {
      case 'test.status':
        return test.status || 'unknown';
      case 'test.epochStartedAt':
        return this.formatDate(test.epochStartedAt || test.epochCreatedAt);
      case 'test.duration':
        return this.getTestDuration(test);
    }

    // Handle summary fields - direct property access
    if (!test.summary) {
      return column.key === 'errorRate' && test.status === 'failed'
        ? '100.00%'
        : '—';
    }

    const { global: g } = test.summary;

    switch (column.field) {
      case 'summary.global.totalRequests':
        return g.totalRequests.toLocaleString();
      case 'summary.global.errorRate':
        return `${((g.failedRequests / g.totalRequests) * 100).toFixed(2)}%`;
      case 'summary.global.successfulRequests':
        return g.successfulRequests.toLocaleString();
      case 'summary.global.failedRequests':
        return g.failedRequests.toLocaleString();
      case 'summary.global.averageLatency':
        return `${g.avgLatencyMs.toFixed(0)}ms`;
      case 'summary.global.p95Latency':
        return `${g.p95LatencyMs.toFixed(0)}ms`;
      case 'summary.global.p99Latency':
        return `${g.p99LatencyMs.toFixed(0)}ms`;
      case 'summary.global.requestsPerSecond':
        return g.actualRps.toLocaleString();
      case 'summary.global.achievedPercentage':
        return `${g.achievedPercentage.toFixed(2)}%`;
      case 'summary.tressiVersion':
        return test.summary.tressiVersion;
      case 'summary.global.minLatency':
        return `${g.minLatencyMs.toFixed(0)}ms`;
      case 'summary.global.maxLatency':
        return `${g.maxLatencyMs.toFixed(0)}ms`;
      case 'summary.global.theoreticalMaxRps':
        return g.theoreticalMaxRps.toLocaleString();
      default:
        return '—';
    }
  }

  getTestDuration(test: TestDocument): string {
    // Use embedded summary duration first
    if (test.summary?.global.duration) {
      return this.testService.formatDuration(
        test.summary.global.duration * 1000,
      );
    }

    // Fallback to timestamp calculation
    if (
      test.status === 'completed' &&
      test.epochStartedAt &&
      test.epochEndedAt
    ) {
      const duration = test.epochEndedAt - test.epochStartedAt;
      return this.testService.formatDuration(duration);
    }

    return this.testService.formatDuration(
      this.testService.getTestDuration(test),
    );
  }

  getStatusColor(status: TestDocument['status']): string {
    return this.testService.getStatusColor(status);
  }

  getStatusIcon(status: TestDocument['status']): IconName {
    switch (status) {
      case 'running':
        return 'rocket';
      case 'completed':
        return 'select';
      case 'failed':
        return 'warning';
      default:
        return 'info';
    }
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  calculateErrorRate(test: TestDocument): string {
    // Use embedded summary
    if (test.summary) {
      const { global: g } = test.summary;
      const errorRate = (g.failedRequests / g.totalRequests) * 100;
      return `${errorRate.toFixed(2)}%`;
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

  getSortIcon(columnKey: string): IconName {
    const sort = this.currentSort();
    if (!sort || sort.columnKey !== columnKey) {
      return 'expand_all';
    }
    return sort.direction === 'asc'
      ? 'keyboard_arrow_up'
      : 'keyboard_arrow_down';
  }

  isColumnSorted(columnKey: string): boolean {
    return this.currentSort()?.columnKey === columnKey;
  }
}
