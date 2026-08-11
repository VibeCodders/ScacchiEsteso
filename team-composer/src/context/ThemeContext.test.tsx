import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';
import { THEME_STORAGE_KEY } from '../lib/theme';

function ToggleProbe() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('dark')}>dark</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <ToggleProbe />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('defaults to light when nothing is stored and no OS preference is available', () => {
    renderProbe();
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reads the stored theme from localStorage and applies the dark class on <html>', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderProbe();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggleTheme flips light → dark, persists to localStorage and toggles the class', () => {
    renderProbe();
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme switches to an explicit theme and persists it', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderProbe();
    fireEvent.click(screen.getByText('light'));
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('throws when useTheme is used outside a ThemeProvider', () => {
    expect(() => render(<ToggleProbe />)).toThrow(/ThemeProvider/);
  });
});
