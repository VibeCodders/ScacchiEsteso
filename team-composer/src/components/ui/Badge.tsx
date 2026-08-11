import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'ok' | 'warn' | 'err' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  ok: 'border-emerald-800 bg-emerald-950/60 text-emerald-400',
  warn: 'border-amber-800 bg-amber-950/60 text-amber-400',
  err: 'border-red-800 bg-red-950/60 text-red-400',
  info: 'border-sky-800 bg-sky-950/60 text-sky-300',
  neutral: 'border-slate-700 bg-slate-800 text-slate-400',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Pill/badge with the app's status tones (ok/warn/err/info/neutral). */
function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-bold', TONES[tone], className)} {...rest} />;
}

export default Badge;
