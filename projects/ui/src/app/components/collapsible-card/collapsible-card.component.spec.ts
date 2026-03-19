import { Component, type TemplateRef, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollapsibleCardComponent } from './collapsible-card.component';

@Component({
  imports: [CollapsibleCardComponent],
  template: `
    <app-collapsible-card
      [title]="'Test Title'"
      [subtitle]="'Test Subtitle'"
      [icon]="'search'"
      [collapsed]="collapsed"
      (collapsedChange)="onCollapsedChange($event)"
    >
      <ng-template #headerContent>
        <div id="header-content">Header Content</div>
      </ng-template>
      <div id="main-content">Main Content</div>
    </app-collapsible-card>
  `,
})
class TestHostComponent {
  collapsed = false;
  onCollapsedChange = vi.fn();
  headerContent = viewChild<TemplateRef<unknown>>('headerContent');
}

describe('CollapsibleCardComponent', () => {
  let component: CollapsibleCardComponent;
  let fixture: ComponentFixture<CollapsibleCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollapsibleCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CollapsibleCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.componentRef.setInput('collapsed', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the title', () => {
    const titleElement = fixture.nativeElement.querySelector('[data-e2e="collapsible-card-title"]');
    expect(titleElement.textContent).toContain('Test Title');
  });

  it('should display the subtitle when provided', () => {
    fixture.componentRef.setInput('subtitle', 'Test Subtitle');
    fixture.detectChanges();

    const subtitleElement = fixture.nativeElement.querySelector('p');
    expect(subtitleElement.textContent).toContain('Test Subtitle');
  });

  it('should not display the subtitle when not provided', () => {
    const subtitleElement = fixture.nativeElement.querySelector('p');
    expect(subtitleElement).toBeNull();
  });

  it('should display the icon when provided', () => {
    fixture.componentRef.setInput('icon', 'search');
    fixture.detectChanges();

    const iconElement = fixture.nativeElement.querySelector('.gap-2 app-icon');
    expect(iconElement).toBeTruthy();
  });

  it('should not display the icon when not provided', () => {
    const iconElement = fixture.nativeElement.querySelector('.gap-2 app-icon');
    expect(iconElement).toBeNull();
  });

  it('should emit collapsedChange when toggleCollapsed is called', () => {
    const emitSpy = vi.spyOn(component.collapsedChange, 'emit');
    component.toggleCollapsed();
    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('should toggle collapsed state when header is clicked', () => {
    const emitSpy = vi.spyOn(component.collapsedChange, 'emit');
    const header = fixture.nativeElement.querySelector('.flex.cursor-pointer');
    header.click();
    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('should toggle collapsed state when button is clicked', () => {
    const emitSpy = vi.spyOn(component.collapsedChange, 'emit');
    const button = fixture.nativeElement.querySelector('app-button');
    button.click();
    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('should apply collapse-collapsed class when collapsed is true', () => {
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    const contentArea = fixture.nativeElement.querySelector('.collapse-transition');
    expect(contentArea.classList.contains('collapse-collapsed')).toBe(true);
    expect(contentArea.classList.contains('collapse-expanded')).toBe(false);
  });

  it('should apply collapse-expanded class when collapsed is false', () => {
    fixture.componentRef.setInput('collapsed', false);
    fixture.detectChanges();

    const contentArea = fixture.nativeElement.querySelector('.collapse-transition');
    expect(contentArea.classList.contains('collapse-collapsed')).toBe(false);
    expect(contentArea.classList.contains('collapse-expanded')).toBe(true);
  });
});

describe('CollapsibleCardComponent with Content Projection', () => {
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, CollapsibleCardComponent],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostFixture.detectChanges();
  });

  it('should project header content', () => {
    const headerContent = hostFixture.nativeElement.querySelector('#header-content');
    expect(headerContent).toBeTruthy();
    expect(headerContent.textContent).toContain('Header Content');
  });

  it('should project main content', () => {
    const mainContent = hostFixture.nativeElement.querySelector('#main-content');
    expect(mainContent).toBeTruthy();
    expect(mainContent.textContent).toContain('Main Content');
  });
});
