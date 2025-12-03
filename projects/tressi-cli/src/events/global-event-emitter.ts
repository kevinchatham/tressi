import EventEmitter from 'eventemitter3';

import { IGlobalServerEvents } from '../types/workers/interfaces';

export const globalEventEmitter = new EventEmitter<IGlobalServerEvents>();
