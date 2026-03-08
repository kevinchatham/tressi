import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconName } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it } from 'vitest';

import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the icon name in the template', () => {
    const iconName: IconName = 'add';
    fixture.componentRef.setInput('name', iconName);
    fixture.detectChanges();

    const spanElement: HTMLElement | null =
      fixture.nativeElement.querySelector('span');
    expect(spanElement).toBeTruthy();
    if (spanElement) {
      expect(spanElement.textContent?.trim()).toBe(iconName);
      expect(spanElement.classList.contains('material-symbols-outlined')).toBe(
        true,
      );
    }
  });

  describe('asHtml', () => {
    it('should return the correct HTML markup for a given icon name', () => {
      const iconName: IconName = 'check';
      const expectedHtml = `<span class="material-symbols-outlined">${iconName}</span>`;
      expect(IconComponent.asHtml(iconName)).toBe(expectedHtml);
    });
  });
});
