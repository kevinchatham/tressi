
/**
 * A memory-efficient circular buffer implementation for storing a fixed number of items.
 * When the buffer is full, new items overwrite the oldest ones.
 */
export class CircularBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private head = 0;
  private tail = 0;
  private isFull = false;

  /**
   * Creates a new CircularBuffer instance.
   * @param capacity The maximum number of items the buffer can hold.
   */
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  /**
   * Adds an item to the buffer. If the buffer is full, it overwrites the oldest item.
   * @param item The item to add.
   */
  add(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.isFull) {
      this.head = (this.head + 1) % this.capacity;
    } else if (this.tail === this.head) {
      this.isFull = true;
    }
  }

  /**
   * Returns all the items in the buffer.
   * @returns An array containing the items.
   */
  getAll(): T[] {
    const result: T[] = [];
    let i = this.head;
    const end = this.tail;

    if (this.isFull) {
      // If full, loop from head to tail covering all elements
      do {
        result.push(this.buffer[i]);
        i = (i + 1) % this.capacity;
      } while (i !== end);
    } else {
      // If not full, just go from head to tail
      while (i !== end) {
        result.push(this.buffer[i]);
        i = (i + 1) % this.capacity;
      }
    }

    return result;
  }

  /**
   * Gets the current number of items in the buffer.
   */
  size(): number {
    if (this.isFull) {
      return this.capacity;
    }
    if (this.tail >= this.head) {
      return this.tail - this.head;
    }
    return this.capacity - this.head + this.tail;
  }
}
