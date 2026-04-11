import {
  Component,
  computed,
  inject,
  input,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  output,
  type SimpleChanges,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import type {
  ConfigDocument,
  TestDocument,
  TestEventData,
  TestSummary,
} from '@tressi/shared/common';
import type { DeleteResult } from '@tressi/shared/ui';
import type { Subscription } from 'rxjs';

import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { TestService } from '../../services/test.service';
import { ButtonComponent } from '../button/button.component';
import { DeleteConfirmationModalComponent } from '../delete-confirmation-modal/delete-confirmation-modal.component';
import { IconComponent } from '../icon/icon.component';
import { StartButtonComponent } from '../start-button/start-button.component';
import { ColumnSelectorComponent } from './column-selector/column-selector.component';
import { TestListColumnsService } from './test-list-columns.service';
import { TestListDeleteService } from './test-list-delete.service';
import { TestListSelectionService } from './test-list-selection.service';
import { TestTableComponent } from './test-table/test-table.component';

@Component({
  imports: [
    RouterModule,
    IconComponent,
    TestTableComponent,
    ColumnSelectorComponent,
    DeleteConfirmationModalComponent,
    StartButtonComponent,
    ButtonComponent,
  ],
  selector: 'app-test-list',
  styleUrl: './test-list.component.css',
  templateUrl: './test-list.component.html',
})
export class TestListComponent implements OnChanges, OnInit, OnDestroy {
  readonly appRouter = inject(AppRouterService);
  private readonly _testService = inject(TestService);
  private readonly _logService = inject(LogService);
  private readonly _eventService = inject(EventService);
  private readonly _columnsService = inject(TestListColumnsService);
  private readonly _selectionService = inject(TestListSelectionService);
  private readonly _deleteService = inject(TestListDeleteService);

  readonly config = input.required<ConfigDocument>();
  readonly testHistoryUpdate = output<boolean>();

  // Signals for reactive state management
  private readonly _tests = signal<TestDocument[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _latestMetrics = signal<TestSummary | null>(null);
  readonly configName = computed(() => this.config()?.name || '[Deleted Configuration]');
  readonly showDeleteModal = signal<boolean>(false);
  readonly testToDelete = signal<TestDocument | null>(null);
  readonly showColumnSelector = signal<boolean>(false);

  // Computed signals for derived state
  readonly displayedTests = computed(() => {
    const tests = this._tests();
    const sortConfig = this.currentSort();

    if (!sortConfig) {
      return tests;
    }

    return this._sortTests(tests, sortConfig);
  });
  readonly hasError = computed(() => this._error() !== null);
  readonly errorMessage = computed(() => this._error());
  readonly hasTests = computed(() => this._tests().length > 0);
  readonly pageTitle = computed(() => `Test History - ${this.configName()}`);

  // Expose service signals and computed values
  readonly visibleColumns = this._columnsService.visibleColumns;
  readonly columnGroups = this._columnsService.columnGroups;
  readonly currentSort = this._columnsService.currentSort;
  readonly selectedTests = this._selectionService.selectedTestsSet;
  readonly selectedTestsCount = computed(() => this._selectionService.getSelectedCount());
  readonly isBulkDelete = computed(() => this._selectionService.getSelectedCount() > 1);

  readonly isAllSelected = computed(() => {
    const allTestIds = this._tests().map((test) => test.id);
    return this._selectionService.isAllSelected(allTestIds);
  });
  readonly isSomeSelected = computed(() => this._selectionService.isSomeSelected());
  readonly hasRunningTestsSelected = computed(() =>
    this._selectionService.hasRunningTestsSelected(this._tests()),
  );

  private _metricsSubscription?: Subscription;
  private _testEventsSubscription?: Subscription;

  ngOnInit(): void {
    this._subscribeToMetrics();
    this._subscribeToTestEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']?.currentValue) {
      this.loadTests();
    }
  }

  async loadTests(): Promise<void> {
    try {
      this._error.set(null);

      // Load tests for this config - use config().id directly
      const tests = await this._testService.getTestsByConfigId(this.config().id);
      this._tests.set(tests);
      // Emit test history update
      this.testHistoryUpdate.emit(tests.length > 0);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load tests');
      this._tests.set([]);
      // Emit test history update (no tests due to error)
      this.testHistoryUpdate.emit(false);
    }
  }

  async refreshTests(): Promise<void> {
    this._error.set(null);
    await this.loadTests();
  }

  /**
   * Handles test started event from StartButtonComponent
   */
  onTestStarted(): void {
    this.refreshTests();
  }

  /**
   * Handles test start failed event from StartButtonComponent
   */
  onTestStartFailed(error: Error): void {
    this._logService.error('Failed to start test:', error);
  }

  // Column management - delegate to service
  toggleColumn(key: string): void {
    this._columnsService.toggleColumn(key);
  }

  resetColumns(): void {
    this._columnsService.resetColumns();
  }

  onColumnReorder(event: { draggedKey: string; targetKey: string }): void {
    this._columnsService.reorderColumn(event.draggedKey, event.targetKey);
  }

  onColumnSort(columnKey: string): void {
    this._columnsService.toggleSort(columnKey);
  }

  toggleColumnSelector(): void {
    this.showColumnSelector.update((value) => !value);
  }

  closeColumnSelector(): void {
    this.showColumnSelector.set(false);
  }

  // Selection management - delegate to service
  toggleTestSelection(testId: string, event: Event): void {
    this._selectionService.toggleTestSelection(testId, event);
  }

  toggleAllTests(event: Event): void {
    const allTestIds = this._tests().map((test) => test.id);
    this._selectionService.toggleAllTests(allTestIds, event);
  }

  // Delete functionality
  async deleteTest(test: TestDocument | null, event: Event): Promise<void> {
    this.showDeleteConfirm(test, event);
  }

  showDeleteConfirm(test: TestDocument | null, event: Event): void {
    event.stopPropagation();
    if (test) {
      this.testToDelete.set(test);
    } else {
      this.testToDelete.set(null);
    }
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.testToDelete.set(null);
    this._selectionService.clearSelection();
  }

  async deleteTestConfirmed(): Promise<void> {
    this.showDeleteModal.set(false);
    this._error.set(null);
    await this.deleteSelectedTests();
  }

  async deleteSelectedTests(): Promise<void> {
    const selectedIds = Array.from(this._selectionService.getSelectedIds());
    if (selectedIds.length === 0) return;

    const result = await this._deleteService.deleteTestsWithLoading(selectedIds);
    this._handleDeleteResult(result, selectedIds);
  }

  private _handleDeleteResult(result: DeleteResult, deletedIds: string[]): void {
    if (result.deletedCount > 0) {
      this._tests.update((tests) => tests.filter((test) => !deletedIds.includes(test.id)));
      // Emit test history update after deletion
      const remainingTests = this._tests();
      this.testHistoryUpdate.emit(remainingTests.length > 0);
    }

    if (result.failedCount > 0) {
      this._error.set(result.errors.join(', ') || `Failed to delete ${result.failedCount} test(s)`);
    }

    this._selectionService.clearSelection();
    this.testToDelete.set(null);
  }

  // Subscription methods
  private _subscribeToMetrics(): void {
    this._metricsSubscription = this._eventService.getMetricsStream().subscribe({
      error: (error: Error) => {
        this._logService.error('Metrics stream error:', error);
      },
      next: ({ testSummary }: { testSummary: TestSummary }) => {
        this._latestMetrics.set(testSummary);
        this._updateRunningTest(testSummary);
      },
    });
  }

  private _subscribeToTestEvents(): void {
    this._testEventsSubscription = this._eventService.getTestEventsStream().subscribe({
      error: (error: Error) => {
        this._logService.error('Test events stream error:', error);
      },
      next: (event: TestEventData) => {
        if (event.configId === this.config().id) {
          this._handleTestEvent(event);
        }
      },
    });
  }

  private async _handleTestEvent(event: TestEventData): Promise<void> {
    if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
      await this._refreshTest(event.testId);
    }
  }

  private async _refreshTest(testId: string): Promise<void> {
    try {
      const updatedTest = await this._testService.getTestById(testId);

      this._tests.update((tests) => {
        const index = tests.findIndex((t) => t.id === testId);
        if (index !== -1) {
          const newTests = [...tests];
          newTests[index] = updatedTest;
          return newTests;
        }
        return tests;
      });
    } catch (error) {
      this._logService.error(`Failed to refresh test ${testId}:`, error);
    }
  }

  private _updateRunningTest(summary: TestSummary): void {
    this._tests.update((tests) => {
      const runningTestIndex = tests.findIndex((t) => t.status === 'running');
      if (runningTestIndex === -1) return tests;

      const updatedTest = { ...tests[runningTestIndex] };
      updatedTest.summary = summary;

      const newTests = [...tests];
      newTests[runningTestIndex] = updatedTest;
      return newTests;
    });
  }

  ngOnDestroy(): void {
    this._metricsSubscription?.unsubscribe();
    this._testEventsSubscription?.unsubscribe();
  }

  private _sortTests(
    tests: TestDocument[],
    sortConfig: { columnKey: string; direction: 'asc' | 'desc' | null },
  ): TestDocument[] {
    const sorted = [...tests];
    const { columnKey, direction } = sortConfig;

    sorted.sort((a, b) => {
      const valueA = this._extractSortValue(a, columnKey);
      const valueB = this._extractSortValue(b, columnKey);

      let comparison = 0;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  private _extractSortValue(test: TestDocument, columnKey: string): string | number {
    const summary = test.summary;
    switch (columnKey) {
      case 'startTime':
        return summary?.global.epochStartedAt || test.epochCreatedAt || 0;
      case 'endTime':
        return summary?.global.epochEndedAt || 0;
      case 'duration':
        return this._extractDurationValue(summary);
      case 'totalRequests':
        return summary?.global.totalRequests || 0;
      case 'errorRate':
        return this._extractErrorRateValue(test, summary);
      case 'successfulRequests':
        return summary?.global.successfulRequests || 0;
      case 'failedRequests':
        return summary?.global.failedRequests || 0;
      case 'p50LatencyMs':
        return summary?.global.p50LatencyMs || 0;
      case 'p95LatencyMs':
        return summary?.global.p95LatencyMs || 0;
      case 'p99LatencyMs':
        return summary?.global.p99LatencyMs || 0;
      case 'minLatencyMs':
        return summary?.global.minLatencyMs || 0;
      case 'maxLatencyMs':
        return summary?.global.maxLatencyMs || 0;
      case 'id':
        return test.id;
      case 'tressiVersion':
        return summary?.tressiVersion || '';
      default:
        return '';
    }
  }

  private _extractDurationValue(summary: TestSummary | null | undefined): number {
    if (summary?.global.finalDurationSec) {
      return summary.global.finalDurationSec;
    }
    if (summary?.global.epochEndedAt && summary?.global.epochStartedAt) {
      return (summary.global.epochEndedAt - summary.global.epochStartedAt) / 1000;
    }
    return 0;
  }

  private _extractErrorRateValue(
    test: TestDocument,
    summary: TestSummary | null | undefined,
  ): number {
    if (summary) {
      return summary.global.failedRequests / summary.global.totalRequests;
    }
    return test.status === 'failed' ? 1 : 0;
  }
}
