import { computed, Injectable, signal } from '@angular/core';

import type { TestDocument } from '../../services/rpc.service';

@Injectable({ providedIn: 'root' })
export class TestListSelectionService {
  private readonly selectedTests = signal<Set<string>>(new Set());

  readonly selectedTestsSet = this.selectedTests.asReadonly();

  readonly selectedTestsList = computed(() => {
    // This will be populated by the component when needed
    return [] as TestDocument[];
  });

  toggleTestSelection(testId: string, event: Event): void {
    event.stopPropagation();
    this.selectedTests.update((selected) => {
      const newSelected = new Set(selected);
      if (newSelected.has(testId)) {
        newSelected.delete(testId);
      } else {
        newSelected.add(testId);
      }
      return newSelected;
    });
  }

  toggleAllTests(allTestIds: string[], event: Event): void {
    event.stopPropagation();
    this.selectedTests.update(() => {
      if (this.isAllSelected(allTestIds)) {
        return new Set();
      } else {
        return new Set(allTestIds);
      }
    });
  }

  isAllSelected(allTestIds: string[]): boolean {
    return (
      allTestIds.length > 0 &&
      allTestIds.every((id) => this.selectedTests().has(id))
    );
  }

  isSomeSelected(): boolean {
    return this.selectedTests().size > 0;
  }

  hasRunningTestsSelected(tests: TestDocument[]): boolean {
    const selectedIds = this.selectedTests();
    return tests.some(
      (test) => selectedIds.has(test.id) && test.status === 'running',
    );
  }

  clearSelection(): void {
    this.selectedTests.set(new Set());
  }

  getSelectedCount(): number {
    return this.selectedTests().size;
  }

  getSelectedIds(): Set<string> {
    return new Set(this.selectedTests());
  }

  setSelectedTests(tests: TestDocument[]): void {
    this.selectedTests.set(new Set(tests.map((t) => t.id)));
  }
}
