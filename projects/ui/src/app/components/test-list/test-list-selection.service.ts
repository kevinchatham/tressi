import { Injectable, signal } from '@angular/core';
import type { TestDocument } from '@tressi/shared/common';

/**
 * Service for managing test selection state in the test list component.
 * Provides methods to toggle, clear, and query test selections.
 */
@Injectable({ providedIn: 'root' })
export class TestListSelectionService {
  private readonly _selectedTests = signal<Set<string>>(new Set());

  /** Read-only signal containing the set of selected test IDs */
  readonly selectedTestsSet = this._selectedTests.asReadonly();

  /**
   * Toggles the selection state of a single test.
   * @param testId - The ID of the test to toggle
   * @param event - The DOM event to prevent propagation
   */
  toggleTestSelection(testId: string, event: Event): void {
    event.stopPropagation();
    this._selectedTests.update((selected) => {
      const newSelected = new Set(selected);
      if (newSelected.has(testId)) {
        newSelected.delete(testId);
      } else {
        newSelected.add(testId);
      }
      return newSelected;
    });
  }

  /**
   * Toggles selection of all tests (select all or deselect all).
   * @param allTestIds - Array of all test IDs available for selection
   * @param event - The DOM event to prevent propagation
   */
  toggleAllTests(allTestIds: string[], event: Event): void {
    event.stopPropagation();
    this._selectedTests.update(() => {
      if (this.isAllSelected(allTestIds)) {
        return new Set();
      } else {
        return new Set(allTestIds);
      }
    });
  }

  /**
   * Checks if all provided test IDs are currently selected.
   * @param allTestIds - Array of test IDs to check
   * @returns true if all test IDs are selected, false otherwise
   */
  isAllSelected(allTestIds: string[]): boolean {
    return allTestIds.length > 0 && allTestIds.every((id) => this._selectedTests().has(id));
  }

  /**
   * Checks if any tests are currently selected.
   * @returns true if at least one test is selected, false otherwise
   */
  isSomeSelected(): boolean {
    return this._selectedTests().size > 0;
  }

  /**
   * Checks if any running tests are currently selected.
   * @param tests - Array of test documents to check against
   * @returns true if any running tests are selected, false otherwise
   */
  hasRunningTestsSelected(tests: TestDocument[]): boolean {
    const selectedIds = this._selectedTests();
    return tests.some((test) => selectedIds.has(test.id) && test.status === 'running');
  }

  /**
   * Clears all test selections.
   */
  clearSelection(): void {
    this._selectedTests.set(new Set());
  }

  /**
   * Gets the count of currently selected tests.
   * @returns The number of selected tests
   */
  getSelectedCount(): number {
    return this._selectedTests().size;
  }

  /**
   * Gets a new Set containing the IDs of all selected tests.
   * @returns A Set of selected test IDs
   */
  getSelectedIds(): Set<string> {
    return new Set(this._selectedTests());
  }

  /**
   * Sets the selected tests to the provided array of tests.
   * @param tests - Array of test documents to set as selected
   */
  setSelectedTests(tests: TestDocument[]): void {
    this._selectedTests.set(new Set(tests.map((t) => t.id)));
  }
}
