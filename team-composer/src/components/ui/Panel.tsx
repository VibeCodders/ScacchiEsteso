import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Optional heading rendered above the panel body. */
  title?: ReactNode;
}

/** Standard card used across every screen — replaces the `.panel` stylesheet class. */
function Panel({ title, className, children, ...rest }: PanelProps) {
  return (
    <section className={cn('panel rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-5', className)} {...rest}>
      {title !== undefined && (
        <h2 className="mb-4 border-b border-slate-300 dark:border-slate-700 pb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      )}
      {children}
    </section>
  );
}

export default Panel;
