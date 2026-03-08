import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastService } from '../../services/toast.service';
import { ToastComponent } from './toast.component';

describe('ToastComponent', () => {
  let component: ToastComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastComponent],
      providers: [
        {
          provide: ToastService,
          useValue: {
            showToast: vi.fn().mockReturnValue(false),
            toastMessage: vi.fn().mockReturnValue(''),
            toastType: vi.fn().mockReturnValue('info'),
            dismiss: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ToastComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
