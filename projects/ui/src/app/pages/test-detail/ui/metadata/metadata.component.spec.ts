import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastService } from '../../../../services/toast.service';
import { MetadataComponent } from './metadata.component';

describe('MetadataComponent', () => {
  let component: MetadataComponent;
  let fixture: ComponentFixture<MetadataComponent>;
  let toastServiceSpy: {
    show: ReturnType<typeof vi.fn>;
  };

  const mockConfig = {
    name: 'Test Config',
    rps: 100,
  };

  beforeEach(async () => {
    toastServiceSpy = {
      show: vi.fn(),
    };

    // Mock navigator.clipboard
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    await TestBed.configureTestingModule({
      imports: [MetadataComponent],
      providers: [{ provide: ToastService, useValue: toastServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(MetadataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit collapsedChange when onCollapsedChange is called', () => {
    const spy = vi.spyOn(component.collapsedChange, 'emit');
    component.onCollapsedChange(false);
    expect(spy).toHaveBeenCalledWith(false);
  });

  describe('copyConfig', () => {
    it('should show error toast if no config snapshot', async () => {
      fixture.componentRef.setInput('configSnapshot', null);
      await component.copyConfig();
      expect(toastServiceSpy.show).toHaveBeenCalledWith('No configuration to copy', 'error');
    });

    it('should copy config to clipboard and show success toast', async () => {
      fixture.componentRef.setInput('configSnapshot', mockConfig);
      await component.copyConfig();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(mockConfig, null, 2),
      );
      expect(toastServiceSpy.show).toHaveBeenCalledWith(
        'Configuration copied to clipboard',
        'success',
      );
      expect(component.copied()).toBe(true);
    });

    it('should reset copied signal after 2 seconds', async () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('configSnapshot', mockConfig);
      await component.copyConfig();
      expect(component.copied()).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(component.copied()).toBe(false);
      vi.useRealTimers();
    });

    it('should show error toast if copy fails', async () => {
      fixture.componentRef.setInput('configSnapshot', mockConfig);
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('fail'));

      await component.copyConfig();
      expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to copy configuration', 'error');
    });
  });
});
