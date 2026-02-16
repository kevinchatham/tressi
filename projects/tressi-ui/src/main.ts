import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  SecurityContext,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withViewTransitions } from '@angular/router';
import {
  CLIPBOARD_OPTIONS,
  MARKED_OPTIONS,
  MERMAID_OPTIONS,
  provideMarkdown,
  SANITIZE,
} from 'ngx-markdown';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
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
          startOnLoad: false,
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
};

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  // eslint-disable-next-line no-console
  console.error(err),
);
