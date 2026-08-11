import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
  toggle: (key: string) => void;
}

/** Shared sorting state for any table/grid in the app: picking a new key sorts it ascending,
 *  picking the active key again flips the direction. */
export function useSortState(initialKey: string, initialDir: SortDir = 'asc'): SortState {
  const [key, setKey] = useState(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const toggle = (next: string) => {
    if (next === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setKey(next);
      setDir('asc');
    }
  };
  return { key, dir, toggle };
}

export type RowComparator<T> = (a: T, b: T) => number;

/** Sorts a copy of `rows` with the comparator registered for `key` (falling back to the input
 *  order when a key has no comparator — e.g. an action-only column). */
export function sortTable<T>(
  rows: T[],
  key: string,
  dir: SortDir,
  comparators: Record<string, RowComparator<T>>,
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  const compare = comparators[key];
  return [...rows].sort((a, b) => (compare ? sign * compare(a, b) : 0));
}
