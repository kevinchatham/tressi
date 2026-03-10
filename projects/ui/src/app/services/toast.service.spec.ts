import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [ToastService],
    });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    expect(service.toastMessage()).toBe('');
    expect(service.toastType()).toBe('info');
    expect(service.showToast()).toBe(false);
  });

  describe('show', () => {
    it('should show a toast with message and type', () => {
      service.show('Test Message', 'success');
      expect(service.toastMessage()).toBe('Test Message');
      expect(service.toastType()).toBe('success');
      expect(service.showToast()).toBe(true);
    });

    it('should auto-dismiss after 5000ms', () => {
      service.show('Auto Dismiss');
      expect(service.showToast()).toBe(true);

      vi.advanceTimersByTime(5000);
      expect(service.showToast()).toBe(false);
    });

    it('should reset existing timeout when showing a new toast', () => {
      service.show('First Toast');
      vi.advanceTimersByTime(3000);

      service.show('Second Toast');
      vi.advanceTimersByTime(3000);

      // If it didn't reset, it would have dismissed by now (3000 + 3000 > 5000)
      expect(service.showToast()).toBe(true);
      expect(service.toastMessage()).toBe('Second Toast');

      vi.advanceTimersByTime(2000);
      expect(service.showToast()).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('should hide the toast immediately', () => {
      service.show('Dismiss Me');
      service.dismiss();
      expect(service.showToast()).toBe(false);
    });

    it('should clear message and type after 300ms fade out', () => {
      service.show('Fade Out', 'error');
      service.dismiss();

      expect(service.toastMessage()).toBe('Fade Out'); // Still there during fade

      vi.advanceTimersByTime(300);
      expect(service.toastMessage()).toBe('');
      expect(service.toastType()).toBe('info');
    });
  });
});
