// Type declarations for browser APIs not yet in TypeScript DOM definitions

interface ViewTransitionUpdateCallback {
  (): void | Promise<void>;
}

interface ViewTransitionTypeSet extends Set<string> {
  add: (type: string) => this;
  clear: () => void;
  delete: (type: string) => boolean;
  has: (type: string) => boolean;
  forEach: (
    callbackfn: (
      value: string,
      value2: string,
      set: ViewTransitionTypeSet,
    ) => void,
    thisArg?: unknown,
  ) => void;
  readonly size: number;
  [Symbol.iterator](): IterableIterator<string>;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
}

interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  types: ViewTransitionTypeSet;
  skipTransition: () => void;
}

interface Document {
  /**
   * The View Transitions API provides a mechanism for controlling animations
   * when changing the DOM in response to user interactions.
   */
  startViewTransition?: (
    callbackOptions?: ViewTransitionUpdateCallback | StartViewTransitionOptions,
  ) => ViewTransition;
}

interface StartViewTransitionOptions {
  types?: string[];
}
