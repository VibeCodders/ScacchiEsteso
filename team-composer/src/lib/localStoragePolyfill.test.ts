import { describe, expect, it, beforeEach } from 'vitest';
import { createInMemoryStorage, ensureLocalStorage } from './localStoragePolyfill';

describe('createInMemoryStorage', () => {
  it('starts empty: no entries, null for any key or index', () => {
    const s = createInMemoryStorage();
    expect(s.length).toBe(0);
    expect(s.getItem('k')).toBeNull();
    expect(s.key(0)).toBeNull();
  });

  it('stores and retrieves values, coercing them to strings like the real Storage', () => {
    const s = createInMemoryStorage();
    s.setItem('a', '1');
    s.setItem('b', 2 as unknown as string); // Storage coerces any value to a string
    expect(s.getItem('a')).toBe('1');
    expect(s.getItem('b')).toBe('2');
    expect(s.length).toBe(2);
  });

  it('returns null for missing keys, enumerates keys in insertion order, null past the end', () => {
    const s = createInMemoryStorage();
    s.setItem('x', '1');
    s.setItem('y', '2');
    expect(s.getItem('missing')).toBeNull();
    expect(s.key(0)).toBe('x');
    expect(s.key(1)).toBe('y');
    expect(s.key(2)).toBeNull();
    expect(s.key(-1)).toBeNull();
  });

  it('overwrites an existing key instead of duplicating it', () => {
    const s = createInMemoryStorage();
    s.setItem('x', '1');
    s.setItem('x', '2');
    expect(s.getItem('x')).toBe('2');
    expect(s.length).toBe(1);
  });

  it('removeItem deletes a single key and clear empties everything', () => {
    const s = createInMemoryStorage();
    s.setItem('x', '1');
    s.setItem('y', '2');
    s.removeItem('x');
    expect(s.getItem('x')).toBeNull();
    expect(s.length).toBe(1);

    s.clear();
    expect(s.length).toBe(0);
    expect(s.getItem('y')).toBeNull();
  });
});

describe('ensureLocalStorage', () => {
  beforeEach(() => {
    // Remove any storage the shared test setup installed, so each case controls the branch taken.
    delete (window as unknown as { localStorage?: unknown }).localStorage;
  });

  it('installs an in-memory localStorage when none exists and returns true', () => {
    expect(window.localStorage).toBeUndefined();
    expect(ensureLocalStorage()).toBe(true);
    expect(window.localStorage).toBeDefined();

    // The installed storage is fully functional.
    window.localStorage.setItem('k', 'v');
    expect(window.localStorage.getItem('k')).toBe('v');
    expect(window.localStorage.length).toBe(1);
    window.localStorage.clear();
    expect(window.localStorage.length).toBe(0);
  });

  it('leaves an existing localStorage untouched and returns false', () => {
    expect(ensureLocalStorage()).toBe(true); // install ours first
    const existing = window.localStorage;

    expect(ensureLocalStorage()).toBe(false);
    expect(window.localStorage).toBe(existing);

    // Values written to the original survive a second call.
    existing.setItem('kept', 'yes');
    expect(window.localStorage.getItem('kept')).toBe('yes');
  });
});
