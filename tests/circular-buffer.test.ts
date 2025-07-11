import { describe, expect, it } from 'vitest';

import { CircularBuffer } from '../src/circular-buffer';

describe('CircularBuffer', () => {
  it('should initialize with the correct capacity', () => {
    const buffer = new CircularBuffer<number>(5);
    expect(buffer.size()).toBe(0);
  });

  it('should add items and increase size', () => {
    const buffer = new CircularBuffer<number>(5);
    buffer.add(1);
    buffer.add(2);
    expect(buffer.size()).toBe(2);
    expect(buffer.getAll()).toEqual([1, 2]);
  });

  it('should not exceed capacity', () => {
    const buffer = new CircularBuffer<number>(3);
    buffer.add(1);
    buffer.add(2);
    buffer.add(3);
    expect(buffer.size()).toBe(3);
    expect(buffer.getAll()).toEqual([1, 2, 3]);
  });

  it('should overwrite the oldest items when full', () => {
    const buffer = new CircularBuffer<number>(3);
    buffer.add(1);
    buffer.add(2);
    buffer.add(3);
    buffer.add(4); // Overwrites 1
    expect(buffer.size()).toBe(3);
    expect(buffer.getAll()).toEqual([2, 3, 4]);
  });

  it('should handle multiple overwrites correctly', () => {
    const buffer = new CircularBuffer<number>(3);
    buffer.add(1);
    buffer.add(2);
    buffer.add(3);
    buffer.add(4); // Overwrites 1
    buffer.add(5); // Overwrites 2
    expect(buffer.size()).toBe(3);
    expect(buffer.getAll()).toEqual([3, 4, 5]);
  });

  it('should return an empty array when empty', () => {
    const buffer = new CircularBuffer<number>(5);
    expect(buffer.getAll()).toEqual([]);
  });

  it('should work with a capacity of 1', () => {
    const buffer = new CircularBuffer<number>(1);
    buffer.add(10);
    expect(buffer.getAll()).toEqual([10]);
    buffer.add(20);
    expect(buffer.getAll()).toEqual([20]);
  });
});
