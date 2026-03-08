import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogService } from './log.service';

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    vi.stubGlobal('console', {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    TestBed.configureTestingModule({
      providers: [LogService],
    });
    service = TestBed.inject(LogService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should log info messages', () => {
    service.info('test info');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith('test info');
  });

  it('should log info messages with optional params', () => {
    service.info('test info', { data: 1 });
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith('test info', [{ data: 1 }]);
  });

  it('should log warn messages', () => {
    service.warn('test warn');
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalledWith('test warn');
  });

  it('should log warn messages with optional params', () => {
    service.warn('test warn', { data: 2 });
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalledWith('test warn', [{ data: 2 }]);
  });

  it('should log error messages', () => {
    service.error('test error');
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith('test error');
  });

  it('should log error messages with optional params', () => {
    service.error('test error', { data: 3 });
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith('test error', [{ data: 3 }]);
  });
});
