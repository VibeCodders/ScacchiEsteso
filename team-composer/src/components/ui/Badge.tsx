import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'ok' | 'warn' | 'err' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  ok: 'border-emerald-300 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
  warn: 'border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
  err: 'border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400',
  info: 'border-sky-300 dark:border-sky-800 bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
  neutral: 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Pill/badge with the app's status tones (ok/warn/err/info/neutral). */
function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-bold', TONES[tone], className)} {...rest} />;
}

export default Badge;
