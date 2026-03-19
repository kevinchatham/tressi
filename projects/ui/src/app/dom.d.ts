// Type declarations for browser APIs not yet in TypeScript DOM definitions

type ViewTransitionUpdateCallback = () => void | Promise<void>;

interface ViewTransitionTypeSet extends Set<string> {
  add: (type: string) => this;
  clear: () => void;
  delete: (type: string) => boolean;
  entries(): IterableIterator<[string, string]>;
  forEach: (
    callbackfn: (value: string, value2: string, set: ViewTransitionTypeSet) => void,
    thisArg?: unknown,
  ) => void;
  has: (type: string) => boolean;
  keys(): IterableIterator<string>;
  readonly size: number;
  values(): IterableIterator<string>;
  [Symbol.iterator](): IterableIterator<string>;
}

interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  skipTransition: () => void;
  types: ViewTransitionTypeSet;
  updateCallbackDone: Promise<void>;
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
