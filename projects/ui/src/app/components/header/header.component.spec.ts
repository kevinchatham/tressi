import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logoSrc } from '../../constants';
import { AppRouterService } from '../../services/router.service';
import { TitleService } from '../../services/title.service';
import { HeaderComponent } from './header.component';

@Component({
  imports: [HeaderComponent],
  template: `
    <app-header>
      <div id="test-content">Extra Content</div>
    </app-header>
  `,
})
class TestHostComponent {}

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let titleServiceMock: { getTitle: ReturnType<typeof vi.fn> };
  let appRouterServiceMock: {
    isOnDocs: WritableSignal<boolean>;
    isOnServerUnavailable: WritableSignal<boolean>;
    toDocs: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    titleServiceMock = {
      getTitle: vi.fn().mockReturnValue('Tressi Test'),
    };

    appRouterServiceMock = {
      isOnDocs: signal(false),
      isOnServerUnavailable: signal(false),
      toDocs: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent, TestHostComponent],
      providers: [
        { provide: TitleService, useValue: titleServiceMock },
        { provide: AppRouterService, useValue: appRouterServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the logo with correct src', () => {
    const img = fixture.debugElement.query(By.css('img'));
    expect(img.nativeElement.src).toContain(logoSrc);
    expect(img.nativeElement.alt).toBe('Tressi Logo');
  });

  it('should display the title from TitleService', () => {
    const titleSpan = fixture.debugElement.query(By.css('span.truncate'));
    expect(titleSpan.nativeElement.textContent.trim()).toBe('Tressi Test');
    expect(titleServiceMock.getTitle).toHaveBeenCalled();
  });

  it('should show the docs button when not on docs or server unavailable page', () => {
    appRouterServiceMock.isOnDocs.set(false);
    appRouterServiceMock.isOnServerUnavailable.set(false);
    fixture.detectChanges();

    const docsButton = fixture.debugElement.query(By.css('app-button'));
    expect(docsButton).toBeTruthy();
    expect(docsButton.componentInstance.title()).toBe('Docs');
  });

  it('should hide the docs button when on docs page', () => {
    appRouterServiceMock.isOnDocs.set(true);
    appRouterServiceMock.isOnServerUnavailable.set(false);
    fixture.detectChanges();

    const docsButton = fixture.debugElement.query(By.css('app-button'));
    expect(docsButton).toBeFalsy();
  });

  it('should hide the docs button when on server unavailable page', () => {
    appRouterServiceMock.isOnDocs.set(false);
    appRouterServiceMock.isOnServerUnavailable.set(true);
    fixture.detectChanges();

    const docsButton = fixture.debugElement.query(By.css('app-button'));
    expect(docsButton).toBeFalsy();
  });

  it('should call appRouter.toDocs() when docs button is clicked', () => {
    appRouterServiceMock.isOnDocs.set(false);
    appRouterServiceMock.isOnServerUnavailable.set(false);
    fixture.detectChanges();

    const docsButton = fixture.debugElement.query(By.css('app-button'));
    docsButton.triggerEventHandler('click', new MouseEvent('click'));

    expect(appRouterServiceMock.toDocs).toHaveBeenCalled();
  });

  it('should render projected content', () => {
    const hostFixture = TestBed.createComponent(TestHostComponent);
    hostFixture.detectChanges();

    const projectedContent = hostFixture.debugElement.query(By.css('#test-content'));
    expect(projectedContent).toBeTruthy();
    expect(projectedContent.nativeElement.textContent).toBe('Extra Content');
  });
});
