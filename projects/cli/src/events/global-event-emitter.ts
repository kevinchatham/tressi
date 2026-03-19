import type { IGlobalServerEvents } from '@tressi/shared/cli';
import EventEmitter from 'eventemitter3';

export const globalEventEmitter: EventEmitter<IGlobalServerEvents> =
  new EventEmitter<IGlobalServerEvents>();
