import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PwaService } from '../../services/pwa.service';
import { PwaInstallerComponent } from './pwa-installer.component';

describe('PwaInstallerComponent', () => {
  let component: PwaInstallerComponent;
  let fixture: ComponentFixture<PwaInstallerComponent>;
  let pwaServiceMock: {
    canInstall: WritableSignal<boolean>;
    dismissPrompt: Mock<() => void>;
    installPwa: Mock<() => Promise<void>>;
  };

  beforeEach(async () => {
    pwaServiceMock = {
      canInstall: signal(false),
      dismissPrompt: vi.fn(),
      installPwa: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PwaInstallerComponent],
      providers: [{ provide: PwaService, useValue: pwaServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(PwaInstallerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show anything if canInstall is false', () => {
    pwaServiceMock.canInstall.set(false);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeFalsy();
  });

  it('should show install prompt if canInstall is true', () => {
    pwaServiceMock.canInstall.set(true);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Install Tressi');
  });

  it('should call dismissPrompt when Dismiss button is clicked', () => {
    pwaServiceMock.canInstall.set(true);
    fixture.detectChanges();

    const dismissButton = fixture.nativeElement.querySelector(
      'button.btn-ghost',
    ) as HTMLButtonElement;
    dismissButton.click();

    expect(pwaServiceMock.dismissPrompt).toHaveBeenCalled();
  });

  it('should call installPwa when Install button is clicked', () => {
    pwaServiceMock.canInstall.set(true);
    fixture.detectChanges();

    const installButton = fixture.nativeElement.querySelector(
      'button.btn-primary',
    ) as HTMLButtonElement;
    installButton.click();

    expect(pwaServiceMock.installPwa).toHaveBeenCalled();
  });
});
