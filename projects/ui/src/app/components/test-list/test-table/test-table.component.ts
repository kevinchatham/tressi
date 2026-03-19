import { type CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, input, output } from '@angular/core';
import type { TestDocument, TestStatus } from '@tressi/shared/common';
import {
  type ColumnConfig,
  ColumnKey,
  type FieldPath,
  type IconName,
  type SortConfig,
} from '@tressi/shared/ui';

import { FormatBytesDirective } from '../../../directives/format/format-bytes.directive';
import { FormatDateDirective } from '../../../directives/format/format-date.directive';
import { FormatDurationDirective } from '../../../directives/format/format-duration.directive';
import { FormatLatencyDirective } from '../../../directives/format/format-latency.directive';
import { FormatNetworkThroughputDirective } from '../../../directives/format/format-network.directive';
import { FormatNumberDirective } from '../../../directives/format/format-number.directive';
import { FormatPercentageDirective } from '../../../directives/format/format-percentage.directive';
import { FormatRpsDirective } from '../../../directives/format/format-rps.directive';
import { TestService } from '../../../services/test.service';
import { IconComponent } from '../../icon/icon.component';
import { StatusBadgeComponent } from '../../status-badge/status-badge.component';

// Define extractor function type
type ValueExtractor = (test: TestDocument) => unknown;

@Component({
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
  selector: 'app-test-table',
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
    select: (): string => '',
    'summary.configSnapshot.options.durationSec': (test: TestDocument): number | null =>
      test.summary?.configSnapshot?.options?.durationSec ?? null,
    'summary.configSnapshot.options.rampUpDurationSec': (test: TestDocument): number | null =>
      test.summary?.configSnapshot?.options?.rampUpDurationSec ?? null,
    'summary.configSnapshot.options.threads': (test: TestDocument): number | null =>
      test.summary?.configSnapshot?.options?.threads ?? null,
    'summary.configSnapshot.options.workerMemoryLimit': (test: TestDocument): number | null =>
      test.summary?.configSnapshot?.options?.workerMemoryLimit ?? null,
    'summary.global.averageRequestsPerSecond': (test: TestDocument): number | null =>
      test.summary?.global.averageRequestsPerSecond ?? null,
    'summary.global.epochEndedAt': (test: TestDocument): number | null =>
      test.summary?.global.epochEndedAt ?? null,
    'summary.global.epochStartedAt': (test: TestDocument): number | null =>
      test.summary?.global.epochStartedAt ?? null,
    'summary.global.errorRate': (test: TestDocument): number | null =>
      test.summary?.global.errorRate ?? null,
    'summary.global.failedRequests': (test: TestDocument): number | null =>
      test.summary?.global.failedRequests ?? null,
    'summary.global.finalDurationSec': (test: TestDocument): number | null =>
      test.summary?.global.finalDurationSec ?? null,
    'summary.global.maxLatencyMs': (test: TestDocument): number | null =>
      test.summary?.global.maxLatencyMs ?? null,
    'summary.global.minLatencyMs': (test: TestDocument): number | null =>
      test.summary?.global.minLatencyMs ?? null,
    'summary.global.networkBytesPerSec': (test: TestDocument): number | null =>
      test.summary?.global.networkBytesPerSec ?? null,
    'summary.global.networkBytesReceived': (test: TestDocument): number | null =>
      test.summary?.global.networkBytesReceived ?? null,
    'summary.global.networkBytesSent': (test: TestDocument): number | null =>
      test.summary?.global.networkBytesSent ?? null,
    'summary.global.p50LatencyMs': (test: TestDocument): number | null =>
      test.summary?.global.p50LatencyMs ?? null,
    'summary.global.p95LatencyMs': (test: TestDocument): number | null =>
      test.summary?.global.p95LatencyMs ?? null,
    'summary.global.p99LatencyMs': (test: TestDocument): number | null =>
      test.summary?.global.p99LatencyMs ?? null,
    'summary.global.peakRequestsPerSecond': (test: TestDocument): number | null =>
      test.summary?.global.peakRequestsPerSecond ?? null,
    'summary.global.successfulRequests': (test: TestDocument): number | null =>
      test.summary?.global.successfulRequests ?? null,
    'summary.global.totalRequests': (test: TestDocument): number | null =>
      test.summary?.global.totalRequests ?? null,
    'summary.tressiVersion': (test: TestDocument): string | null =>
      test.summary?.tressiVersion ?? null,
    'test.duration': (test: TestDocument): number => this.getTestDurationRaw(test),
    'test.epochStartedAt': (test: TestDocument): number =>
      test.summary?.global.epochStartedAt || test.epochCreatedAt,
    'test.status': (test: TestDocument): string => test.status || 'unknown',
  };

  // biome-ignore lint/suspicious/noExplicitAny: columns
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
      return (test.summary.global.epochEndedAt - test.summary.global.epochStartedAt) / 1000;
    }

    return this._testService.getTestDuration(test) / 1000;
  }

  onViewTest(testId: string): void {
    this.viewTest.emit(testId);
  }

  onToggleSelection(testId: string, event: Event): void {
    this.toggleSelection.emit({ event, testId });
  }

  onToggleAllSelection(event: Event): void {
    this.toggleAllSelection.emit(event);
  }

  onToggleStatus(status: TestStatus, event: Event): void {
    this.tests()
      .filter((t) => t.status === status)
      .forEach((t) => void this.toggleSelection.emit({ event, testId: t.id }));
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
    return sort.direction === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  isColumnSorted(columnKey: string): boolean {
    return this.currentSort()?.columnKey === columnKey;
  }
}
