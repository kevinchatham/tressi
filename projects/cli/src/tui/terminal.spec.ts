/* eslint-disable no-console */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { terminal } from './terminal';

describe('terminal', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print a message', () => {
    terminal.print('hello');
    expect(console.log).toHaveBeenCalledWith('hello');
  });

  it('should print an error', () => {
    terminal.error('error');
    expect(console.error).toHaveBeenCalledWith('error');
  });

  it('should clear the terminal', () => {
    terminal.clear();
    expect(console.clear).toHaveBeenCalled();
  });

  it('should clear and print a message', () => {
    terminal.clearAndPrint('hello');
    expect(console.clear).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('hello');
  });
});
