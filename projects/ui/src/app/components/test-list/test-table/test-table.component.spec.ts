import { DragDropModule } from '@angular/cdk/drag-drop';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestService } from '../../../services/test.service';
import { TestTableComponent } from './test-table.component';

describe('TestTableComponent', () => {
  let component: TestTableComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DragDropModule, TestTableComponent],
      providers: [
        {
          provide: TestService,
          useValue: { getTestDuration: vi.fn().mockReturnValue(0) },
        },
      ],
    });
    const fixture = TestBed.createComponent(TestTableComponent);
    component = fixture.componentInstance;

    // Mock required inputs
    fixture.componentRef.setInput('tests', []);
    fixture.componentRef.setInput('columns', []);
    fixture.componentRef.setInput('selectedTests', new Set());
    fixture.componentRef.setInput('isAllSelected', false);
    fixture.componentRef.setInput('isSomeSelected', false);
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
