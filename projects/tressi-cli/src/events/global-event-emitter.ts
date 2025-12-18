import EventEmitter from 'eventemitter3';

import { IGlobalServerEvents } from '../workers/interfaces';

export const globalEventEmitter = new EventEmitter<IGlobalServerEvents>();
