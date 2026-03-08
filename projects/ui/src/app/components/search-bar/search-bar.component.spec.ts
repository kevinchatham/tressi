import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchBarComponent } from './search-bar.component';

describe('SearchBarComponent', () => {
  let component: SearchBarComponent;
  let fixture: ComponentFixture<SearchBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the correct query value', () => {
    const testQuery = 'test search';
    fixture.componentRef.setInput('query', testQuery);
    fixture.detectChanges();

    const inputElement = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(inputElement.value).toBe(testQuery);
  });

  it('should emit queryChange when input changes', () => {
    const testQuery = 'new search';
    const inputElement = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;

    const spy = vi.spyOn(component.queryChange, 'emit');

    inputElement.value = testQuery;
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(testQuery);
  });
});
