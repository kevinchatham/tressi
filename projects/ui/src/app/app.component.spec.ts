import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppComponent } from './app.component';
import { PwaService } from './services/pwa.service';
import { AppRouterService } from './services/router.service';
import { ThemeService } from './services/theme.service';
import { TitleService } from './services/title.service';
import { ToastService } from './services/toast.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  let titleServiceSpy: { resetTitle: ReturnType<typeof vi.fn> };
  let themeServiceSpy: { loadInitialTheme: ReturnType<typeof vi.fn> };
  let appRouterServiceSpy: { isNavigating: WritableSignal<boolean> };
  let pwaServiceSpy: { canInstall: WritableSignal<boolean> };
  let toastServiceSpy: {
    toastMessage: WritableSignal<string>;
    toastType: WritableSignal<string>;
    showToast: WritableSignal<boolean>;
  };

  let isNavigatingSignal: WritableSignal<boolean>;

  beforeEach(async () => {
    isNavigatingSignal = signal(false);

    titleServiceSpy = {
      resetTitle: vi.fn(),
    };

    themeServiceSpy = {
      loadInitialTheme: vi.fn(),
    };

    appRouterServiceSpy = {
      isNavigating: isNavigatingSignal,
    };

    pwaServiceSpy = {
      canInstall: signal(false),
    };

    toastServiceSpy = {
      toastMessage: signal(''),
      toastType: signal('info'),
      showToast: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: TitleService, useValue: titleServiceSpy },
        { provide: ThemeService, useValue: themeServiceSpy },
        { provide: AppRouterService, useValue: appRouterServiceSpy },
        { provide: PwaService, useValue: pwaServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize title and theme on init', () => {
    expect(titleServiceSpy.resetTitle).toHaveBeenCalled();
    expect(themeServiceSpy.loadInitialTheme).toHaveBeenCalled();
  });

  it('should render child components', () => {
    const loading = fixture.debugElement.query(By.css('app-loading'));
    const toast = fixture.debugElement.query(By.css('app-toast'));
    const pwaInstaller = fixture.debugElement.query(
      By.css('app-pwa-installer'),
    );
    const routerOutlet = fixture.debugElement.query(By.css('router-outlet'));

    expect(loading).toBeTruthy();
    expect(toast).toBeTruthy();
    expect(pwaInstaller).toBeTruthy();
    expect(routerOutlet).toBeTruthy();
  });

  it('should pass navigating state to loading component', () => {
    const loading = fixture.debugElement.query(By.css('app-loading'));

    // Initial state
    expect(loading.componentInstance.navigating()).toBe(false);

    // Update state
    isNavigatingSignal.set(true);
    fixture.detectChanges();

    expect(loading.componentInstance.navigating()).toBe(true);
  });
});
