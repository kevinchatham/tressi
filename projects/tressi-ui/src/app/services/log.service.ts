/* eslint-disable no-console */

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LogService {
  info(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(message, optionalParams);
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    console.warn(message, optionalParams);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(message, optionalParams);
  }
}
