import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TimeService } from './time.service';

describe('TimeService', () => {
  let service: TimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TimeService],
    });
    service = TestBed.inject(TimeService);
  });

  it('should return a relative time string', () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const result = service.getRelativeTimeString(oneHourAgo);

    expect(result).toBe('an hour ago');
  });

  it('should handle future dates', () => {
    const now = Date.now();
    const inOneHour = now + 3600000;

    const result = service.getRelativeTimeString(inOneHour);

    expect(result).toBe('in an hour');
  });
});
