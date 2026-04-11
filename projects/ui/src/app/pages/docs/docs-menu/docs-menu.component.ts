import { KeyValuePipe, NgClass } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import type { DocSearchResult, MarkdownSlugs } from '@tressi/shared/common';
import { AppRoutes } from '@tressi/shared/ui';
import { filter } from 'rxjs';
import { IconComponent } from '../../../components/icon/icon.component';

import { SearchBarComponent } from '../../../components/search-bar/search-bar.component';
import { AppRouterService } from '../../../services/router.service';
import { RPCService } from '../../../services/rpc.service';

@Component({
  imports: [RouterModule, KeyValuePipe, SearchBarComponent, IconComponent, NgClass],
  selector: 'app-docs-menu',
  styleUrl: './docs-menu.component.css',
  templateUrl: './docs-menu.component.html',
})
export class DocsMenuComponent {
  availableDocs = input<MarkdownSlugs>();

  expandedSection = signal<string | null>(null);
  isCollapsed = signal(false);
  searchQuery = signal('');
  searchResults = signal<DocSearchResult[]>([]);
  isSearching = signal(false);

  readonly appRouter = inject(AppRouterService);
  private readonly _rpc = inject(RPCService);
  private readonly _router = inject(Router);
  private readonly _currentUrl = signal(this.appRouter.getCurrentUrl());

  constructor() {
    // Update the currentUrl signal on every successful navigation
    // We still need to listen to router events for URL updates
    this._router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event: NavigationEnd) => {
        this._currentUrl.set(event.urlAfterRedirects);
      });

    effect(() => {
      const docs = this.availableDocs();
      const url = this._currentUrl();

      if (!docs) return;

      // Find which section contains the current URL
      let matchedSection: string | null = null;
      for (const [sectionKey, sectionValue] of Object.entries(docs)) {
        const section = sectionValue as { path: string };
        const sectionPath = section.path;
        if (sectionPath && url.includes(`/${AppRoutes.DOCS}/${sectionPath}`)) {
          matchedSection = sectionKey;
          break;
        }
      }

      // Set the matched section, or default to the first section if no match is found
      const firstSectionKey = Object.keys(docs)[0];
      this.expandedSection.set(matchedSection ?? firstSectionKey ?? null);
    });

    // Search effect
    effect(async () => {
      const query = this.searchQuery();
      if (!query || query.length < 2) {
        this.searchResults.set([]);
        this.isSearching.set(false);
        return;
      }

      this.isSearching.set(true);
      try {
        const response = await this._rpc.client.docs['search']['$get']({
          query: { q: query },
        });
        if (response.ok) {
          const results = await response.json();
          // Hono client types might be tricky here, but we know it's SearchResult[]
          this.searchResults.set(results as DocSearchResult[]);
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: default
        console.error('Search failed', error);
      } finally {
        this.isSearching.set(false);
      }
    });
  }

  readonly getWrapperClass = computed(() => {
    if (this.isCollapsed()) {
      return 'bg-base-300/70 border-base-content/10 flex justify-center items-center rounded-xl w-8';
    } else {
      return 'bg-base-300/70 border-base-content/10 flex flex-col gap-4 rounded-xl border-2 p-4';
    }
  });

  // Custom comparator to preserve the order from the server
  readonly preserveOrder = computed(() => 0);

  toggleSection(sectionKey: string): void {
    const docs = this.availableDocs();
    if (!docs) return;

    const section = docs[sectionKey];
    if (!section) return;

    // Navigate to the section's index (e.g., /docs/getting-started)
    this.appRouter.toDocs(section.path);

    // Ensure the section expands immediately
    this.expandedSection.set(sectionKey);
  }

  formatTitle(title: string): string {
    return title
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
  }
}
