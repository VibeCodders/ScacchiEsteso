import type { ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/cn';
import Button from './Button';

export type PageLayout = 'center' | 'single' | 'two' | 'board';

interface PageShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned header content (badges, back buttons…). */
  actions?: ReactNode;
  /** 'center' = one centered column; 'single' = one full-width column; 'two' = roster+composer;
   *  'board' = board + 320px sidebar. Defaults to 'single'. */
  layout?: PageLayout;
  className?: string;
  children: ReactNode;
}

const LAYOUT_CLASSES: Record<PageLayout, string> = {
  center: 'grid-cols-1 justify-items-center pt-8',
  single: 'grid-cols-1',
  two: 'grid-cols-1 lg:grid-cols-2',
  board: 'main-board-layout grid-cols-1 lg:grid-cols-[1fr_320px] pt-4',
};

/**
 * Shared app shell: theme-aware background, gradient header with title/subtitle/actions and the
 * responsive content grid. The header also hosts the light/dark theme toggle, so it's available
 * on every screen. Replaces the `.app`/`.header`/`.main` classes from the old stylesheet (the
 * `.main` + `main-board-layout` class names are kept on the element, as tests rely on them).
 */
function PageShell({ title, subtitle, actions, layout = 'single', className, children }: PageShellProps) {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="app min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <header className="header flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-br from-slate-100 to-white px-8 py-5 max-sm:px-4 max-sm:py-4 dark:border-sky-900 dark:from-slate-800 dark:to-slate-900">
        <div>
          <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
          {subtitle !== undefined && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          <Button
            variant="ghost"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
            title={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </Button>
        </div>
      </header>
      <main className={cn('main mx-auto grid w-full max-w-[1400px] gap-6 px-8 py-6 max-sm:px-4', LAYOUT_CLASSES[layout], className)}>
        {children}
      </main>
    </div>
  );
}

export default PageShell;
