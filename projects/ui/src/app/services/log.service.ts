/** biome-ignore-all lint/suspicious/noConsole: default */

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LogService {
  info(message?: unknown, ...optionalParams: unknown[]): void {
    if (optionalParams && optionalParams.length > 0) console.log(message, optionalParams);
    else console.log(message);
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    if (optionalParams && optionalParams.length > 0) console.warn(message, optionalParams);
    else console.warn(message);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    if (optionalParams && optionalParams.length > 0) console.error(message, optionalParams);
    else console.error(message);
  }
}
