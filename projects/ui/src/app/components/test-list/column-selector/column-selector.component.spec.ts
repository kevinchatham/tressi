import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ColumnSelectorComponent } from './column-selector.component';

describe('ColumnSelectorComponent', () => {
  let component: ColumnSelectorComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ColumnSelectorComponent],
    });
    const fixture = TestBed.createComponent(ColumnSelectorComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
