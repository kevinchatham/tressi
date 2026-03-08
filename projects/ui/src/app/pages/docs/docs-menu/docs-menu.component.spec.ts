import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { DocSearchResult, MarkdownSlugs } from '@tressi/shared/common';
import { AppRoutes } from '@tressi/shared/ui';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouterService } from '../../../services/router.service';
import { RPCService } from '../../../services/rpc.service';
import { DocsMenuComponent } from './docs-menu.component';

describe('DocsMenuComponent', () => {
  let component: DocsMenuComponent;
  let fixture: ComponentFixture<DocsMenuComponent>;
  let mockRouterEvents: Subject<NavigationEnd>;
  let mockRouter: {
    events: ReturnType<typeof mockRouterEvents.asObservable>;
    routerState: { root: object };
    createUrlTree: ReturnType<typeof vi.fn>;
    serializeUrl: ReturnType<typeof vi.fn>;
  };
  let mockAppRouter: {
    getCurrentUrl: ReturnType<typeof vi.fn>;
    toDocs: ReturnType<typeof vi.fn>;
  };
  let mockRPC: {
    client: {
      docs: {
        search: {
          $get: ReturnType<typeof vi.fn>;
        };
      };
    };
  };

  const mockAvailableDocs: MarkdownSlugs = {
    'Getting Started': {
      path: 'getting-started',
      realPath: 'docs/01-getting-started',
      docs: [
        {
          slug: 'index',
          sectionSlug: 'getting-started',
          realPath: 'docs/01-getting-started/index.md',
        },
        {
          slug: 'quickstart',
          sectionSlug: 'getting-started',
          realPath: 'docs/01-getting-started/02-quickstart.md',
        },
      ],
    },
    'Core Concepts': {
      path: 'core-concepts',
      realPath: 'docs/02-core-concepts',
      docs: [
        {
          slug: 'index',
          sectionSlug: 'core-concepts',
          realPath: 'docs/02-core-concepts/index.md',
        },
        {
          slug: 'methodology',
          sectionSlug: 'core-concepts',
          realPath: 'docs/02-core-concepts/01-methodology.md',
        },
      ],
    },
  };

  beforeEach(async () => {
    mockRouterEvents = new Subject();
    mockRouter = {
      events: mockRouterEvents.asObservable(),
      routerState: { root: {} },
      createUrlTree: vi.fn().mockReturnValue({}),
      serializeUrl: vi.fn().mockReturnValue(''),
    };

    mockAppRouter = {
      getCurrentUrl: vi
        .fn()
        .mockReturnValue(`/${AppRoutes.DOCS}/getting-started/quickstart`),
      toDocs: vi.fn(),
    };

    mockRPC = {
      client: {
        docs: {
          search: {
            $get: vi.fn(),
          },
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [DocsMenuComponent],
      providers: [
        provideRouter([]),
        { provide: Router, useValue: mockRouter },
        { provide: AppRouterService, useValue: mockAppRouter },
        { provide: RPCService, useValue: mockRPC },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocsMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('availableDocs', mockAvailableDocs);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with correct default values', () => {
    expect(component.isCollapsed()).toBe(false);
    expect(component.searchQuery()).toBe('');
    expect(component.searchResults()).toEqual([]);
    expect(component.isSearching()).toBe(false);
  });

  it('should toggle collapse', () => {
    component.toggleCollapse();
    expect(component.isCollapsed()).toBe(true);
    component.toggleCollapse();
    expect(component.isCollapsed()).toBe(false);
  });

  it('should format title correctly', () => {
    expect(component.formatTitle('getting-started')).toBe('Getting Started');
    expect(component.formatTitle('quickstart')).toBe('Quickstart');
    expect(component.formatTitle('my-cool-doc')).toBe('My Cool Doc');
  });

  it('should update search query on search', () => {
    component.onSearch('test');
    expect(component.searchQuery()).toBe('test');
  });

  it('should toggle section and navigate', () => {
    component.toggleSection('Core Concepts');
    expect(component.expandedSection()).toBe('Core Concepts');
    expect(mockAppRouter.toDocs).toHaveBeenCalledWith('core-concepts');
  });

  it('should not toggle section if it does not exist', () => {
    const initialSection = component.expandedSection();
    component.toggleSection('Non Existent');
    expect(component.expandedSection()).toBe(initialSection);
    expect(mockAppRouter.toDocs).not.toHaveBeenCalled();
  });

  it('should return correct wrapper class when expanded', () => {
    component.isCollapsed.set(false);
    expect(component.getWrapperClass()).toContain('flex-col');
    expect(component.getWrapperClass()).toContain('p-4');
  });

  it('should return correct wrapper class when collapsed', () => {
    component.isCollapsed.set(true);
    expect(component.getWrapperClass()).toContain('justify-center');
    expect(component.getWrapperClass()).toContain('w-8');
  });

  it('should return 0 for preserveOrder', () => {
    expect(component.preserveOrder()).toBe(0);
  });

  it('should update expandedSection based on URL on initialization', () => {
    // In beforeEach, getCurrentUrl returns '/docs/getting-started/quickstart'
    // The effect should have set expandedSection to 'Getting Started'
    expect(component.expandedSection()).toBe('Getting Started');
  });

  it('should update expandedSection when router navigation ends', () => {
    mockRouterEvents.next(
      new NavigationEnd(
        1,
        `/${AppRoutes.DOCS}/core-concepts/methodology`,
        `/${AppRoutes.DOCS}/core-concepts/methodology`,
      ),
    );
    fixture.detectChanges();
    expect(component.expandedSection()).toBe('Core Concepts');
  });

  it('should default to first section if URL does not match any section', () => {
    mockRouterEvents.next(
      new NavigationEnd(
        1,
        `/${AppRoutes.DOCS}/unknown`,
        `/${AppRoutes.DOCS}/unknown`,
      ),
    );
    fixture.detectChanges();
    expect(component.expandedSection()).toBe('Getting Started');
  });

  it('should perform search when query is at least 2 characters', async () => {
    const mockResults: DocSearchResult[] = [
      {
        title: 'Test Doc',
        path: 'test-doc',
        section: 'Test',
        content: 'content',
        slug: 'test-doc',
      },
    ];
    mockRPC.client.docs.search.$get.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults),
    });

    component.onSearch('te');

    // Wait for effect
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockRPC.client.docs.search.$get).toHaveBeenCalledWith({
      query: { q: 'te' },
    });
    expect(component.searchResults()).toEqual(mockResults);
    expect(component.isSearching()).toBe(false);
  });

  it('should clear search results when query is less than 2 characters', async () => {
    component.searchResults.set([
      {
        title: 'Test',
        path: 'test',
        section: 'Test',
        content: 'content',
        slug: 'test',
      },
    ]);
    component.onSearch('t');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.searchResults()).toEqual([]);
    expect(mockRPC.client.docs.search.$get).not.toHaveBeenCalled();
  });
});
