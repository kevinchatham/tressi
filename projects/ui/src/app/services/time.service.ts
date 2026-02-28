import { Injectable } from '@angular/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

@Injectable({
  providedIn: 'root',
})
export class TimeService {
  getRelativeTimeString(date: number): string {
    return dayjs(date).fromNow();
  }
}
