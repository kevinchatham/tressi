import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, input, output } from '@angular/core';

import { FormatBytesDirective } from '../../../directives/format/format-bytes.directive';
import { FormatDateDirective } from '../../../directives/format/format-date.directive';
import { FormatDurationDirective } from '../../../directives/format/format-duration.directive';
import { FormatLatencyDirective } from '../../../directives/format/format-latency.directive';
import { FormatNetworkThroughputDirective } from '../../../directives/format/format-network.directive';
import { FormatNumberDirective } from '../../../directives/format/format-number.directive';
import { FormatPercentageDirective } from '../../../directives/format/format-percentage.directive';
import { FormatRpsDirective } from '../../../directives/format/format-rps.directive';
import { ColumnConfig } from '../../../services/local-storage.service';
import type { TestDocument } from '../../../services/rpc.service';
import { TestService } from '../../../services/test.service';
import { IconComponent, IconName } from '../../icon/icon.component';
import { StatusBadgeComponent } from '../../status-badge/status-badge.component';
import { ColumnKey, FieldPath } from '../column-keys.enum';
import type { SortConfig } from '../test-list-columns.service';

// Define extractor function type
type ValueExtractor = (test: TestDocument) => unknown;

@Component({
  selector: 'app-test-table',
  imports: [
    IconComponent,
    DragDropModule,
    StatusBadgeComponent,
    FormatDurationDirective,
    FormatDateDirective,
    FormatPercentageDirective,
    FormatRpsDirective,
    FormatNumberDirective,
    FormatBytesDirective,
    FormatNetworkThroughputDirective,
    FormatLatencyDirective,
  ],
  templateUrl: './test-table.component.html',
})
export class TestTableComponent {
  readonly tests = input.required<TestDocument[]>();
  readonly columns = input.required<ColumnConfig[]>();
  readonly selectedTests = input.required<Set<string>>();
  readonly isAllSelected = input.required<boolean>();
  readonly isSomeSelected = input.required<boolean>();
  readonly currentSort = input<SortConfig | null>(null);

  readonly viewTest = output<string>();
  readonly toggleSelection = output<{ testId: string; event: Event }>();
  readonly toggleAllSelection = output<Event>();
  readonly columnReorder = output<{ draggedKey: string; targetKey: string }>();
  readonly columnSort = output<string>();

  private readonly _testService = inject(TestService);

  // Create complete mapping that TypeScript will type-check
  private readonly _valueExtractors: Record<FieldPath, ValueExtractor> = {
    select: () => '',
    'test.status': (test) => test.status || 'unknown',
    'test.epochStartedAt': (test) =>
      test.summary?.global.epochStartedAt || test.epochCreatedAt,
    'test.duration': (test) => this.getTestDurationRaw(test),
    'summary.global.totalRequests': (test) =>
      test.summary?.global.totalRequests ?? null,
    'summary.global.successfulRequests': (test) =>
      test.summary?.global.successfulRequests ?? null,
    'summary.global.failedRequests': (test) =>
      test.summary?.global.failedRequests ?? null,
    'summary.global.p50LatencyMs': (test) =>
      test.summary?.global.p50LatencyMs ?? null,
    'summary.global.p95LatencyMs': (test) =>
      test.summary?.global.p95LatencyMs ?? null,
    'summary.global.p99LatencyMs': (test) =>
      test.summary?.global.p99LatencyMs ?? null,
    'summary.tressiVersion': (test) => test.summary?.tressiVersion ?? null,
    'summary.global.minLatencyMs': (test) =>
      test.summary?.global.minLatencyMs ?? null,
    'summary.global.maxLatencyMs': (test) =>
      test.summary?.global.maxLatencyMs ?? null,
    'summary.global.epochStartedAt': (test) =>
      test.summary?.global.epochStartedAt ?? null,
    'summary.global.epochEndedAt': (test) =>
      test.summary?.global.epochEndedAt ?? null,
    'summary.global.networkBytesSent': (test) =>
      test.summary?.global.networkBytesSent ?? null,
    'summary.global.networkBytesReceived': (test) =>
      test.summary?.global.networkBytesReceived ?? null,
    'summary.global.networkBytesPerSec': (test) =>
      test.summary?.global.networkBytesPerSec ?? null,
    'summary.global.errorRate': (test) =>
      test.summary?.global.errorRate ?? null,
    'summary.global.averageRequestsPerSecond': (test) =>
      test.summary?.global.averageRequestsPerSecond ?? null,
    'summary.global.peakRequestsPerSecond': (test) =>
      test.summary?.global.peakRequestsPerSecond ?? null,
    'summary.global.finalDurationSec': (test) =>
      test.summary?.global.finalDurationSec ?? null,
    'summary.configSnapshot.options.durationSec': (test) =>
      test.summary?.configSnapshot?.options?.durationSec ?? null,
    'summary.configSnapshot.options.threads': (test) =>
      test.summary?.configSnapshot?.options?.threads ?? null,
    'summary.configSnapshot.options.workerMemoryLimit': (test) =>
      test.summary?.configSnapshot?.options?.workerMemoryLimit ?? null,
    'summary.configSnapshot.options.rampUpDurationSec': (test) =>
      test.summary?.configSnapshot?.options?.rampUpDurationSec ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getColumnValue(test: TestDocument, column: ColumnConfig): any {
    // Handle special 'select' column which doesn't extract data
    if (column.field === 'select') {
      return '';
    }

    const extractor = this._valueExtractors[column.field];
    if (!extractor) {
      return null; // This should never happen with proper typing
    }
    return extractor(test);
  }

  getTestDurationRaw(test: TestDocument): number {
    // Use embedded summary duration first (in seconds)
    if (test.summary?.global.finalDurationSec) {
      return test.summary.global.finalDurationSec;
    }

    // Fallback to timestamp calculation using embedded summary fields
    if (
      test.status === 'completed' &&
      test.summary?.global.epochStartedAt &&
      test.summary?.global.epochEndedAt
    ) {
      return (
        (test.summary.global.epochEndedAt -
          test.summary.global.epochStartedAt) /
        1000
      );
    }

    return this._testService.getTestDuration(test) / 1000;
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
