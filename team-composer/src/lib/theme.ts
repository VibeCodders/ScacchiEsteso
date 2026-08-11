export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'scacchi-esteso-theme';

/** Stored preference wins; otherwise the OS preference; otherwise light. */
export function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private mode, tests without DOM storage) — fall through
  }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // matchMedia unavailable — fall through
  }
  return 'light';
}

/** Toggles the `dark` class on <html> — the marker the Tailwind `dark:` variant listens for. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Applies the persisted/derived theme immediately, before first paint (no flash of wrong theme). */
export function applyStoredTheme(): void {
  applyTheme(getStoredTheme());
}
