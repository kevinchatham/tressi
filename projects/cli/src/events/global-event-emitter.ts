import { IGlobalServerEvents } from '@tressi/shared/cli';
import EventEmitter from 'eventemitter3';

export const globalEventEmitter = new EventEmitter<IGlobalServerEvents>();
