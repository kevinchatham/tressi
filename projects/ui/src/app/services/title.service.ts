import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TitleService {
  private readonly _titleService = inject(Title);
  private readonly _router = inject(Router);

  private readonly _defaultTitle = 'Tressi';
  private _currentTitle = this._defaultTitle;

  constructor() {
    this._initializeRouteListener();
  }

  private _initializeRouteListener(): void {
    this._router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this._updateTitleFromRoute();
      });
  }

  private _updateTitleFromRoute(): void {
    let route = this._router.routerState.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    route.data.subscribe((d: { title?: string }) => {
      const title = d.title || this._defaultTitle;
      this.setTitle(title);
    });
  }

  setTitle(title: string): void {
    this._currentTitle = title;
    this._titleService.setTitle(title);
  }

  getTitle(): string {
    return this._currentTitle;
  }

  resetTitle(): void {
    this.setTitle(this._defaultTitle);
  }
}
