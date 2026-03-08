import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownSlugs } from '@tressi/shared/common';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouterService } from '../../services/router.service';
import { ThemeService } from '../../services/theme.service';
import { DocsComponent } from './docs.component';

@Component({
  selector: 'markdown',
  template: '',
  standalone: true,
})
class MockMarkdownComponent {
  @Input() src?: string;
  @Input() mermaid?: boolean;
  @Input() mermaidOptions?: object;
  @Output() load = new EventEmitter<void>();
  @Output() error = new EventEmitter<void>();
}

describe('DocsComponent', () => {
  let component: DocsComponent;
  let fixture: ComponentFixture<DocsComponent>;
  let mockAppRouter: {
    back: ReturnType<typeof vi.fn>;
    toHome: ReturnType<typeof vi.fn>;
    toDocs: ReturnType<typeof vi.fn>;
    isOnDocs: ReturnType<typeof vi.fn>;
    getCurrentUrl: ReturnType<typeof vi.fn>;
    isOnDocsSubroute: ReturnType<typeof vi.fn>;
    isOnServerUnavailable: ReturnType<typeof vi.fn>;
  };
  let mockThemeService: {
    isDark: ReturnType<typeof vi.fn>;
  };

  const mockAvailableDocs: MarkdownSlugs = {
    'getting-started': {
      path: 'getting-started',
      realPath: '01-getting-started',
      docs: [
        {
          slug: 'index',
          realPath: '01-getting-started/index',
          sectionSlug: 'getting-started',
        },
        {
          slug: 'intro',
          realPath: '01-getting-started/01-intro',
          sectionSlug: 'getting-started',
        },
      ],
    },
    'core-concepts': {
      path: 'core-concepts',
      realPath: '02-core-concepts',
      docs: [
        {
          slug: 'index',
          realPath: '02-core-concepts/index',
          sectionSlug: 'core-concepts',
        },
      ],
    },
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    mockAppRouter = {
      back: vi.fn(),
      toHome: vi.fn(),
      toDocs: vi.fn(),
      isOnDocs: vi.fn().mockReturnValue(true),
      getCurrentUrl: vi.fn().mockReturnValue('http://localhost/docs'),
      isOnDocsSubroute: vi.fn().mockReturnValue(false),
      isOnServerUnavailable: vi.fn().mockReturnValue(false),
    };

    mockThemeService = {
      isDark: vi.fn().mockReturnValue(true),
    };

    // Mock window.scrollTo
    window.scrollTo = vi.fn();

    await TestBed.configureTestingModule({
      imports: [DocsComponent],
      providers: [
        provideRouter([]),
        { provide: AppRouterService, useValue: mockAppRouter },
        { provide: ThemeService, useValue: mockThemeService },
        provideMarkdown(),
      ],
    })
      .overrideComponent(DocsComponent, {
        remove: { imports: [MarkdownModule] },
        add: { imports: [MockMarkdownComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DocsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('availableDocs', mockAvailableDocs);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load the first section index by default when no section or filename is provided', () => {
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      expect(component.markdownSrc()).toBe('/docs/01-getting-started/index.md');
      expect(component.currentSectionFolder()).toBe('01-getting-started');
    });

    it('should load specific section and filename when provided', () => {
      fixture.componentRef.setInput('section', 'getting-started');
      fixture.componentRef.setInput('filename', 'intro');
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      expect(component.markdownSrc()).toBe(
        '/docs/01-getting-started/01-intro.md',
      );
      expect(component.currentSectionFolder()).toBe('01-getting-started');
    });
  });

  describe('loadDocs', () => {
    it('should set isTransitioning to true and then false after loading', () => {
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      component.loadDocs('getting-started/intro');
      expect(component.isTransitioning()).toBe(true);

      vi.advanceTimersByTime(150);
      expect(component.markdownSrc()).toBe(
        '/docs/01-getting-started/01-intro.md',
      );

      component.onLoad();
      vi.advanceTimersByTime(100);
      expect(component.isTransitioning()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should set error message when onError is called', () => {
      fixture.detectChanges();
      component.onError();
      expect(component.error()).toBe('Failed to load documentation.');
      expect(component.isTransitioning()).toBe(false);
    });
  });

  describe('Theme Integration', () => {
    it('should use dark theme for mermaid when theme service is dark', () => {
      mockThemeService.isDark.mockReturnValue(true);
      fixture.detectChanges();
      expect(component.mermaidOptions().theme).toBe('dark');
    });

    it('should use default theme for mermaid when theme service is light', () => {
      mockThemeService.isDark.mockReturnValue(false);
      fixture.detectChanges();
      expect(component.mermaidOptions().theme).toBe('default');
    });
  });

  describe('_fixRelativePaths', () => {
    it('should fix relative image paths', () => {
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      component.currentSectionFolder.set('01-getting-started');

      // Manually add an image to the component's markdown-body
      const container = fixture.nativeElement.querySelector('.markdown-body');
      const img = document.createElement('img');
      img.setAttribute('src', 'images/test.png');
      container.appendChild(img);

      component.onLoad();

      expect(img.src).toContain('/docs/01-getting-started/images/test.png');
      expect(img.style.maxHeight).toBe('350px');
    });

    it('should parse image size from filename', () => {
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      component.currentSectionFolder.set('01-getting-started');

      const container = fixture.nativeElement.querySelector('.markdown-body');
      const img = document.createElement('img');
      img.setAttribute('src', 'images/test-512.png');
      container.appendChild(img);

      component.onLoad();

      expect(img.style.maxHeight).toBe('512px');
    });

    it('should fix relative link paths and handle clicks', () => {
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      component.currentSectionFolder.set('01-getting-started');

      const container = fixture.nativeElement.querySelector('.markdown-body');
      const link = document.createElement('a');
      link.setAttribute('href', 'intro.md');
      link.textContent = 'Intro';
      container.appendChild(link);

      component.onLoad();

      expect(link.getAttribute('href')).toBe('/docs/getting-started/intro');

      link.click();
      expect(mockAppRouter.toDocs).toHaveBeenCalledWith(
        'getting-started',
        'intro',
      );
    });

    it('should handle links to other sections', () => {
      fixture.detectChanges();
      vi.advanceTimersByTime(150);

      component.currentSectionFolder.set('01-getting-started');

      const container = fixture.nativeElement.querySelector('.markdown-body');
      const link = document.createElement('a');
      link.setAttribute('href', '../02-core-concepts/index.md');
      container.appendChild(link);

      component.onLoad();

      expect(link.getAttribute('href')).toBe('/docs/core-concepts/index');

      link.click();
      expect(mockAppRouter.toDocs).toHaveBeenCalledWith(
        'core-concepts',
        'index',
      );
    });
  });
});
