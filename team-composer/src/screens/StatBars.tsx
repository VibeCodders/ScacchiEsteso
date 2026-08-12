import { cn } from '../lib/cn';

export interface StatBarItem {
  label: string;
  /** Secondary text next to the label (e.g. "×2" for a captured-piece count). */
  hint?: string;
  value: number;
}

interface StatBarsProps {
  bars: StatBarItem[];
  color: string;
  formatValue?: (value: number) => string;
  emptyText?: string;
}

/** Compact horizontal bar list: label + proportional bar + value, used by the post-match
 *  statistics panels ("what each side lost", "which pieces moved the most"). Bars scale to the
 *  largest value in the list; pure presentation, no axes. */
function StatBars({ bars, color, formatValue, emptyText = 'Nessun dato.' }: StatBarsProps) {
  if (bars.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="flex w-16 shrink-0 items-baseline gap-1">
            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{b.label}</span>
            {b.hint && <span className="text-[0.65rem] text-slate-400 dark:text-slate-500">{b.hint}</span>}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
            <div
              className={cn('h-full rounded', b.value <= 0 && 'bg-transparent')}
              style={{ width: `${(b.value / max) * 100}%`, backgroundColor: color }}
              data-testid="stat-bar"
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
            {formatValue ? formatValue(b.value) : b.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default StatBars;
