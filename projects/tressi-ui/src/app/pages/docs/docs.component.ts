import {
  Component,
  computed,
  inject,
  OnInit,
  SecurityContext,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  CLIPBOARD_OPTIONS,
  MarkdownModule,
  MARKED_OPTIONS,
  MERMAID_OPTIONS,
  MermaidAPI,
  provideMarkdown,
  SANITIZE,
} from 'ngx-markdown';
import { ThemeSwitcherComponent } from 'src/app/components/theme-switcher/theme-switcher.component';

import { ButtonComponent } from '../../components/button/button.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AppRouterService } from '../../services/router.service';
import { GetDocsResponseSuccess } from '../../services/rpc.service';
import { ThemeService } from '../../services/theme.service';
import { DocsMenuComponent } from './docs-menu/docs-menu.component';

@Component({
  selector: 'app-docs',
  imports: [
    RouterModule,
    MarkdownModule,
    HeaderComponent,
    ButtonComponent,
    IconComponent,
    DocsMenuComponent,
    ThemeSwitcherComponent,
  ],
  providers: [
    provideMarkdown({
      sanitize: {
        provide: SANITIZE,
        useValue: SecurityContext.NONE,
      },
      clipboardOptions: {
        provide: CLIPBOARD_OPTIONS,
        useValue: {
          buttonComponent: undefined,
        },
      },
      mermaidOptions: {
        provide: MERMAID_OPTIONS,
        useValue: {
          startOnLoad: true,
          theme: 'dark',
        },
      },
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: {
          gfm: true,
          breaks: false,
          pedantic: false,
        },
      },
    }),
  ],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DocsComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _themeService = inject(ThemeService);
  readonly appRouter = inject(AppRouterService);
  readonly markdownSrc = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly availableDocs = signal<GetDocsResponseSuccess>({});
  readonly isTransitioning = signal(false);
  readonly isBaseUrl = computed<boolean>(() => this.appRouter.isOnDocs());
  readonly currentSectionFolder = signal<string | null>(null);
  readonly mermaidOptions = computed<MermaidAPI.MermaidConfig>(() => {
    const theme = this._themeService.isDark()
      ? ('dark' as const)
      : ('default' as const);
    return {
      theme,
      startOnLoad: true,
    };
  });

  ngOnInit(): void {
    this._initializeFromResolvedData();
    this._route.params.subscribe((params) => {
      const section = params['section'];
      const filename = params['filename'];

      if (!section && !filename) {
        // Default to the first section's index
        const docs = this.availableDocs();
        const firstSection = Object.values(docs)[0];
        if (firstSection) {
          this.loadDocs(firstSection.path);
        }
      } else {
        const effectiveFilename = filename || 'index';
        const fullPath = section
          ? `${section}/${effectiveFilename}`
          : effectiveFilename;
        this.loadDocs(fullPath);
      }
    });
  }

  /**
   * Initializes the component using data pre-resolved by the router.
   */
  private _initializeFromResolvedData(): void {
    const data = this._route.snapshot.data[
      'availableDocs'
    ] as GetDocsResponseSuccess;
    if (data) {
      this.availableDocs.set(data);
    }
  }

  loadDocs(slug: string): void {
    this.isTransitioning.set(true);

    // Small delay to allow fade out to start/complete
    setTimeout(() => {
      this.error.set(null);

      let realPath = slug;
      const docs = this.availableDocs();
      this.currentSectionFolder.set(null);

      // Find the real path from the nice slug
      for (const section of Object.values(docs)) {
        // Check if the slug is exactly the section path (e.g. /docs/core-concepts)
        // If so, we want to load the index file for that section
        if (section.path === slug && section.path !== '') {
          const indexDoc = section.docs.find((d) => d.slug === 'index');
          if (indexDoc) {
            realPath = indexDoc.realPath;
            this.currentSectionFolder.set(section.realPath);
            break;
          }
        }

        const docMatch = section.docs.find(
          (d) => `${d.sectionSlug}/${d.slug}` === slug,
        );

        if (docMatch) {
          realPath = docMatch.realPath;
          this.currentSectionFolder.set(section.realPath);
          break;
        }
      }

      const safeFilename = realPath.endsWith('.md')
        ? realPath
        : `${realPath}.md`;

      // Use root-relative path to ensure it works regardless of current route depth
      this.markdownSrc.set(`/docs/${safeFilename}`);
    }, 150);
  }

  onLoad(): void {
    this._fixRelativePaths();

    // Small delay to ensure the markdown is fully rendered
    setTimeout(() => {
      this.isTransitioning.set(false);
    }, 100);
  }

  /**
   * Fixes relative paths for both images and links in the rendered markdown.
   * Handles ./ and ../ paths correctly using native URL resolution.
   */
  private _fixRelativePaths(): void {
    const section = this.currentSectionFolder();
    if (!section) return;

    const container = document.querySelector('.markdown-body');
    if (!container) return;

    // 1. Fix Images
    container.querySelectorAll('img').forEach((img: HTMLImageElement) => {
      const src = img.getAttribute('src');

      if (src && !src.startsWith('http') && !src.startsWith('/')) {
        // Resolve relative path
        img.src = new URL(src, `http://x/docs/${section}/`).pathname;

        // Default size to 350, override if pattern like "-512.png" is found
        let size = 350;
        const sizeMatch = src.match(/-(\d+)\.[^.]+$/);

        if (sizeMatch) {
          const parsed = parseInt(sizeMatch[1], 10);
          if (!isNaN(parsed)) {
            size = parsed;
          }
        }

        // Apply styles
        img.style.cssText = `max-height: ${size}px; display: block; margin: 0 auto;`;
      }
    });

    // 2. Fix Links
    container.querySelectorAll('a').forEach((link: HTMLAnchorElement) => {
      const href = link.getAttribute('href');
      if (
        href &&
        !href.startsWith('http') &&
        !href.startsWith('/') &&
        !href.startsWith('#')
      ) {
        // Resolve path and remove .md extension
        const resolved = new URL(href, `http://x/docs/${section}/`).pathname;
        const cleanPath = resolved.replace(/\.md$/, '');

        // Strip number prefixes (e.g., 01-) from each segment for the final route
        const slugPath = cleanPath
          .split('/')
          .map((segment) => segment.replace(/^\d+-/, ''))
          .join('/');

        link.href = slugPath;
        link.onclick = (event: MouseEvent): void => {
          event.preventDefault();

          // Extract segments for Angular navigation: /docs/section/file -> [section, file]
          const [targetSection, targetFile = 'index'] = slugPath
            .split('/')
            .filter((p) => !!p && p !== 'docs');

          this.appRouter.toDocs(targetSection, targetFile);
        };
      }
    });
  }

  onError(): void {
    this.error.set('Failed to load documentation.');
    this.isTransitioning.set(false);
  }
}
