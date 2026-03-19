import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TitleService } from './title.service';

describe('TitleService', () => {
  let service: TitleService;
  let mockTitle: { setTitle: Mock };
  let mockRouter: { events: Subject<unknown>; routerState: unknown };

  beforeEach(() => {
    mockTitle = { setTitle: vi.fn() };
    mockRouter = {
      events: new Subject<unknown>(),
      routerState: {
        root: {
          data: of({ title: 'Initial Title' }),
          firstChild: null,
        },
      },
    };

    TestBed.configureTestingModule({
      providers: [
        TitleService,
        { provide: Title, useValue: mockTitle },
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(TitleService);
  });

  it('should initialize and set default title', () => {
    expect(service.getTitle()).toBe('Tressi');
  });

  it('should update title when navigation ends', () => {
    // Mock nested route data
    const mockRoute = {
      data: of({ title: 'Dashboard' }),
      firstChild: null,
    };

    (mockRouter.routerState as unknown as { root: { firstChild: unknown } }).root.firstChild =
      mockRoute;

    // Trigger NavigationEnd
    const navEnd = { url: '/dashboard' };
    Object.setPrototypeOf(navEnd, NavigationEnd.prototype);
    mockRouter.events.next(navEnd);

    expect(service.getTitle()).toBe('Dashboard');
    expect(mockTitle.setTitle).toHaveBeenCalledWith('Dashboard');
  });

  it('should use default title if route data has no title', () => {
    const mockRoute = {
      data: of({}),
      firstChild: null,
    };

    (mockRouter.routerState as unknown as { root: { firstChild: unknown } }).root.firstChild =
      mockRoute;

    const navEnd = { url: '/home' };
    Object.setPrototypeOf(navEnd, NavigationEnd.prototype);
    mockRouter.events.next(navEnd);

    expect(service.getTitle()).toBe('Tressi');
    expect(mockTitle.setTitle).toHaveBeenCalledWith('Tressi');
  });

  it('should manually set title', () => {
    service.setTitle('Custom Title');
    expect(service.getTitle()).toBe('Custom Title');
    expect(mockTitle.setTitle).toHaveBeenCalledWith('Custom Title');
  });

  it('should reset title to default', () => {
    service.setTitle('Temporary');
    service.resetTitle();
    expect(service.getTitle()).toBe('Tressi');
    expect(mockTitle.setTitle).toHaveBeenCalledWith('Tressi');
  });
});
