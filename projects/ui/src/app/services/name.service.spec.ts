import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { NameService } from './name.service';

describe('NameService', () => {
  let service: NameService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NameService],
    });
    service = TestBed.inject(NameService);
  });

  it('should generate a random name', () => {
    const name = service.generate();
    expect(typeof name).toBe('string');
    expect(name.split(' ')).toHaveLength(2);
  });

  it('should generate different names', () => {
    const name1 = service.generate();
    const name2 = service.generate();
    // While theoretically possible to be the same, it's highly unlikely
    expect(name1).not.toBe(name2);
  });
});
