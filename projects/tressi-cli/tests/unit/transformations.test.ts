import { describe, expect, it } from 'vitest';

import { calculateExpectedRequests } from '../../src/reporting/utils/transformations';

describe('calculateExpectedRequests', () => {
  it('should calculate full requests without ramp-up', () => {
    const result = calculateExpectedRequests(100, 0, 60);
    expect(result).toBe(6000); // 100 * 60
  });

  it('should calculate reduced requests with ramp-up', () => {
    // Linear ramp-up: (100/2)*30 + 100*30 = 1500 + 3000 = 4500
    const result = calculateExpectedRequests(100, 30, 60);
    expect(result).toBe(4500);
  });

  it('should handle ramp-up longer than duration', () => {
    // If ramp-up > duration, treat as full ramp-up
    const result = calculateExpectedRequests(100, 120, 60);
    expect(result).toBe(6000); // 100 * 60 (no steady state)
  });

  it('should handle fractional RPS correctly', () => {
    const result = calculateExpectedRequests(0.5, 10, 30);
    // (0.5/2)*10 + 0.5*20 = 2.5 + 10 = 12.5 -> 13
    expect(result).toBe(13);
  });

  it('should handle undefined ramp-up duration', () => {
    const result = calculateExpectedRequests(50, undefined, 30);
    expect(result).toBe(1500); // 50 * 30
  });

  it('should handle zero ramp-up duration', () => {
    const result = calculateExpectedRequests(25, 0, 10);
    expect(result).toBe(250); // 25 * 10
  });

  it('should handle equal ramp-up and duration', () => {
    // Full ramp-up, no steady state
    const result = calculateExpectedRequests(20, 10, 10);
    expect(result).toBe(100); // (20/2)*10 = 100
  });
});
