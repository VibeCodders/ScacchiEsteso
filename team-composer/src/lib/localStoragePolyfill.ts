/**
 * In-memory `Storage` fallback for environments without DOM storage (private browsing, and this
 * project's jsdom 30 + vitest setup, which does not expose `window.localStorage` even with a real
 * origin). Implements the standard `Storage` surface backed by a `Map`, so it behaves like the
 * real thing: keys are coerced to strings, insertion order is kept, missing keys/out-of-range
 * indices return null, and `clear` empties everything.
 */
export function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

/**
 * Ensures `window.localStorage` exists, installing an in-memory fallback when the environment
 * doesn't provide one. Returns true when a polyfill was installed, false when the native (or
 * already-installed) storage was left untouched.
 */
export function ensureLocalStorage(): boolean {
  if (typeof window === 'undefined' || window.localStorage) return false;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createInMemoryStorage(),
  });
  return true;
}
