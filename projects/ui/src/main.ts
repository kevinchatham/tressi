import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions(), withComponentInputBinding()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  // eslint-disable-next-line no-console
  console.error(err),
);
