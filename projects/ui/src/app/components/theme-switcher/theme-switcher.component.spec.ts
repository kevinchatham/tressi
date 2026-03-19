import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from '../../services/theme.service';
import { ThemeSwitcherComponent } from './theme-switcher.component';

describe('ThemeSwitcherComponent', () => {
  let component: ThemeSwitcherComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ThemeSwitcherComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            isDark: vi.fn().mockReturnValue(false),
            toggleTheme: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
