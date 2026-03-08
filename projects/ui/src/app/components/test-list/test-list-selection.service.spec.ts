import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TestListSelectionService } from './test-list-selection.service';

describe('TestListSelectionService', () => {
  let service: TestListSelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestListSelectionService],
    });
    service = TestBed.inject(TestListSelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should toggle test selection', () => {
    const event = { stopPropagation: () => {} } as unknown as Event;
    service.toggleTestSelection('test-1', event);
    expect(service.selectedTestsSet().has('test-1')).toBe(true);
    service.toggleTestSelection('test-1', event);
    expect(service.selectedTestsSet().has('test-1')).toBe(false);
  });

  it('should check if all selected', () => {
    const event = { stopPropagation: () => {} } as unknown as Event;
    service.toggleTestSelection('test-1', event);
    expect(service.isAllSelected(['test-1'])).toBe(true);
    expect(service.isAllSelected(['test-1', 'test-2'])).toBe(false);
  });
});
