import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ensureLocalStorage } from './lib/localStoragePolyfill';

// This jsdom setup (jsdom 30 as wired by vitest) does not expose window.localStorage even though
// the document has a real origin. Install the shared in-memory fallback so the app's persistence
// paths (theme, game setup) are actually testable instead of silently falling into their
// try/catch "storage unavailable" branches.
ensureLocalStorage();

afterEach(() => {
  cleanup();
});
