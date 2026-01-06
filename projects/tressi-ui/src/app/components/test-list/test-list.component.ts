import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import type { TestSummary } from '@tressi-cli/reporting/types';
import { Subscription } from 'rxjs';

import { EventService } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LogService } from '../../services/log.service';
import type { ConfigDocument, TestDocument } from '../../services/rpc.service';
import { TestService } from '../../services/test.service';
import { IconComponent } from '../icon/icon.component';
import { StartButtonComponent } from '../start-button/start-button.component';
import { ColumnSelectorComponent } from './column-selector/column-selector.component';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';
import { TestListColumnsService } from './test-list-columns.service';
import {
  DeleteResult,
  TestListDeleteService,
} from './test-list-delete.service';
import { TestListSelectionService } from './test-list-selection.service';
import { TestTableComponent } from './test-table/test-table.component';

@Component({
  selector: 'app-test-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    TestTableComponent,
    ColumnSelectorComponent,
    DeleteConfirmationModalComponent,
    StartButtonComponent,
  ],
  templateUrl: './test-list.component.html',
})
export class TestListComponent implements OnChanges, OnInit, OnDestroy {
  config = input.required<ConfigDocument>();

  /** Output event to notify parent component about test history changes */
  readonly testHistoryUpdate = output<boolean>();

  private readonly router = inject(Router);
  private readonly testService = inject(TestService);
  private readonly logService = inject(LogService);
  private readonly loadingService = inject(LoadingService);
  private readonly eventService = inject(EventService);
  private readonly columnsService = inject(TestListColumnsService);
  private readonly selectionService = inject(TestListSelectionService);
  private readonly deleteService = inject(TestListDeleteService);

  // Signals for reactive state management
  private readonly tests = signal<TestDocument[]>([]);
  readonly configName = computed(
    () => this.config()?.name || '[Deleted Configuration]',
  );
  private readonly error = signal<string | null>(null);
  readonly showDeleteModal = signal<boolean>(false);
  readonly testToDelete = signal<TestDocument | null>(null);
  readonly isBulkDelete = signal<boolean>(false);
  private readonly latestMetrics = signal<TestSummary | null>(null);
  readonly showColumnSelector = signal<boolean>(false);

  // Computed signals for derived state
  readonly displayedTests = computed(() => {
    const tests = this.tests();
    const sortConfig = this.currentSort();

    if (!sortConfig) {
      return tests;
    }

    return this.sortTests(tests, sortConfig);
  });
  readonly hasError = computed(() => this.error() !== null);
  readonly errorMessage = computed(() => this.error());
  readonly hasTests = computed(() => this.tests().length > 0);
  readonly pageTitle = computed(() => `Test History - ${this.configName()}`);

  // Expose service signals and computed values
  readonly visibleColumns = this.columnsService.visibleColumns;
  readonly columnGroups = this.columnsService.columnGroups;
  readonly currentSort = this.columnsService.currentSort;
  readonly selectedTests = this.selectionService.selectedTestsSet;
  readonly selectedTestsCount = computed(() =>
    this.selectionService.getSelectedCount(),
  );
  readonly isAllSelected = computed(() => {
    const allTestIds = this.tests().map((test) => test.id);
    return this.selectionService.isAllSelected(allTestIds);
  });
  readonly isSomeSelected = computed(() =>
    this.selectionService.isSomeSelected(),
  );
  readonly hasRunningTestsSelected = computed(() =>
    this.selectionService.hasRunningTestsSelected(this.tests()),
  );

  private metricsSubscription?: Subscription;
  private testEventsSubscription?: Subscription;

  ngOnInit(): void {
    this.loadingService.registerPage('test-list');
    this.subscribeToMetrics();
    this.subscribeToTestEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && changes['config'].currentValue) {
      this.loadTests();
    }
  }

  async loadTests(): Promise<void> {
    try {
      this.loadingService.setPageLoading('test-list', true);
      this.error.set(null);

      // Load tests for this config - use config().id directly
      const tests = await this.testService.getTestsByConfigId(this.config().id);
      this.tests.set(tests);
      // Emit test history update
      this.testHistoryUpdate.emit(tests.length > 0);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load tests',
      );
      this.tests.set([]);
      // Emit test history update (no tests due to error)
      this.testHistoryUpdate.emit(false);
    } finally {
      this.loadingService.setPageLoading('test-list', false);
    }
  }

  viewTestDetails(testId: string): void {
    this.router.navigate(['/tests', testId]);
  }

  async refreshTests(): Promise<void> {
    this.error.set(null);
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
    this.logService.error('Failed to start test:', error);
  }

  // Column management - delegate to service
  toggleColumn(key: string): void {
    this.columnsService.toggleColumn(key);
  }

  resetColumns(): void {
    this.columnsService.resetColumns();
  }

  onColumnReorder(event: { draggedKey: string; targetKey: string }): void {
    this.columnsService.reorderColumn(event.draggedKey, event.targetKey);
  }

  onColumnSort(columnKey: string): void {
    this.columnsService.toggleSort(columnKey);
  }

  toggleColumnSelector(): void {
    this.showColumnSelector.update((value) => !value);
  }

  closeColumnSelector(): void {
    this.showColumnSelector.set(false);
  }

  // Selection management - delegate to service
  toggleTestSelection(testId: string, event: Event): void {
    this.selectionService.toggleTestSelection(testId, event);
  }

  toggleAllTests(event: Event): void {
    const allTestIds = this.tests().map((test) => test.id);
    this.selectionService.toggleAllTests(allTestIds, event);
  }

  // Delete functionality
  async deleteTest(test: TestDocument | null, event: Event): Promise<void> {
    this.showDeleteConfirm(test, event);
  }

  showDeleteConfirm(test: TestDocument | null, event: Event): void {
    event.stopPropagation();
    if (test) {
      this.isBulkDelete.set(false);
      this.testToDelete.set(test);
    } else {
      this.isBulkDelete.set(true);
      this.testToDelete.set(null);
    }
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.testToDelete.set(null);
    this.isBulkDelete.set(false);
    this.selectionService.clearSelection();
  }

  async deleteTestConfirmed(): Promise<void> {
    this.showDeleteModal.set(false);
    this.error.set(null);

    if (this.isBulkDelete()) {
      await this.deleteSelectedTests();
    } else {
      const test = this.testToDelete();
      if (!test) return;

      const result = await this.deleteService.deleteTestWithLoading(test.id);
      this.handleDeleteResult(result, [test.id]);
    }
  }

  async deleteSelectedTests(): Promise<void> {
    const selectedIds = Array.from(this.selectionService.getSelectedIds());
    if (selectedIds.length === 0) return;

    const result = await this.deleteService.deleteTestsWithLoading(selectedIds);
    this.handleDeleteResult(result, selectedIds);
  }

  private handleDeleteResult(result: DeleteResult, deletedIds: string[]): void {
    if (result.deletedCount > 0) {
      this.tests.update((tests) =>
        tests.filter((test) => !deletedIds.includes(test.id)),
      );
      // Emit test history update after deletion
      const remainingTests = this.tests();
      this.testHistoryUpdate.emit(remainingTests.length > 0);
    }

    if (result.failedCount > 0) {
      this.error.set(
        result.errors.join(', ') ||
          `Failed to delete ${result.failedCount} test(s)`,
      );
    }

    this.selectionService.clearSelection();
    this.testToDelete.set(null);
  }

  // Subscription methods
  private subscribeToMetrics(): void {
    this.metricsSubscription = this.eventService.getMetricsStream().subscribe({
      next: ({ testSummary }) => {
        this.latestMetrics.set(testSummary);
        this.updateRunningTest(testSummary);
      },
      error: (error: Error) => {
        this.logService.error('Metrics stream error:', error);
      },
    });
  }

  private subscribeToTestEvents(): void {
    this.testEventsSubscription = this.eventService
      .getTestEventsStream()
      .subscribe({
        next: (event) => {
          if (event.configId === this.config().id) {
            this.handleTestEvent(event);
          }
        },
        error: (error: Error) => {
          this.logService.error('Test events stream error:', error);
        },
      });
  }

  private async handleTestEvent(event: {
    testId: string;
    status: string;
    configId?: string;
  }): Promise<void> {
    if (event.status === 'completed' || event.status === 'failed') {
      await this.refreshTest(event.testId);
    }
  }

  private async refreshTest(testId: string): Promise<void> {
    try {
      const updatedTest = await this.testService.getTestById(testId);

      this.tests.update((tests) => {
        const index = tests.findIndex((t) => t.id === testId);
        if (index !== -1) {
          const newTests = [...tests];
          newTests[index] = updatedTest;
          return newTests;
        }
        return tests;
      });
    } catch (error) {
      this.logService.error(`Failed to refresh test ${testId}:`, error);
    }
  }

  private updateRunningTest(summary: TestSummary): void {
    this.tests.update((tests) => {
      const runningTestIndex = tests.findIndex((t) => t.status === 'running');
      if (runningTestIndex === -1) return tests;

      const updatedTest = { ...tests[runningTestIndex] };
      updatedTest.summary = summary;
      updatedTest.epochUpdatedAt = Date.now();

      const newTests = [...tests];
      newTests[runningTestIndex] = updatedTest;
      return newTests;
    });
  }

  ngOnDestroy(): void {
    this.metricsSubscription?.unsubscribe();
    this.testEventsSubscription?.unsubscribe();
  }

  private sortTests(
    tests: TestDocument[],
    sortConfig: { columnKey: string; direction: 'asc' | 'desc' },
  ): TestDocument[] {
    const sorted = [...tests];
    const { columnKey, direction } = sortConfig;

    sorted.sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      // Handle different column keys and extract values
      switch (columnKey) {
        case 'startTime':
          valueA = a.epochStartedAt || a.epochCreatedAt || 0;
          valueB = b.epochStartedAt || b.epochCreatedAt || 0;
          break;
        case 'duration':
          // Use summary duration if available, otherwise calculate from timestamps
          valueA =
            a.summary?.global.duration ||
            (a.epochEndedAt && a.epochStartedAt
              ? (a.epochEndedAt - a.epochStartedAt) / 1000
              : 0);
          valueB =
            b.summary?.global.duration ||
            (b.epochEndedAt && b.epochStartedAt
              ? (b.epochEndedAt - b.epochStartedAt) / 1000
              : 0);
          break;
        case 'requests':
          valueA = a.summary?.global.totalRequests || 0;
          valueB = b.summary?.global.totalRequests || 0;
          break;
        case 'errorRate':
          valueA = a.summary
            ? a.summary.global.failedRequests / a.summary.global.totalRequests
            : a.status === 'failed'
              ? 1
              : 0;
          valueB = b.summary
            ? b.summary.global.failedRequests / b.summary.global.totalRequests
            : b.status === 'failed'
              ? 1
              : 0;
          break;
        case 'successfulRequests':
          valueA = a.summary?.global.successfulRequests || 0;
          valueB = b.summary?.global.successfulRequests || 0;
          break;
        case 'failedRequests':
          valueA = a.summary?.global.failedRequests || 0;
          valueB = b.summary?.global.failedRequests || 0;
          break;
        case 'avgLatency':
          valueA = a.summary?.global.avgLatencyMs || 0;
          valueB = b.summary?.global.avgLatencyMs || 0;
          break;
        case 'p95Latency':
          valueA = a.summary?.global.p95LatencyMs || 0;
          valueB = b.summary?.global.p95LatencyMs || 0;
          break;
        case 'p99Latency':
          valueA = a.summary?.global.p99LatencyMs || 0;
          valueB = b.summary?.global.p99LatencyMs || 0;
          break;
        case 'minLatency':
          valueA = a.summary?.global.minLatencyMs || 0;
          valueB = b.summary?.global.minLatencyMs || 0;
          break;
        case 'maxLatency':
          valueA = a.summary?.global.maxLatencyMs || 0;
          valueB = b.summary?.global.maxLatencyMs || 0;
          break;
        case 'id':
          valueA = a.id;
          valueB = b.id;
          break;
        case 'tressiVersion':
          valueA = a.summary?.tressiVersion || '';
          valueB = b.summary?.tressiVersion || '';
          break;
        default:
          // For any other columns, use string comparison
          valueA = '';
          valueB = '';
          break;
      }

      // Handle string vs number comparison
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
}
