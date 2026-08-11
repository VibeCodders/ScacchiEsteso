import type { SortDir, SortState } from '../../lib/sort';
import { cn } from '../../lib/cn';

/** Clickable table header that toggles the sort direction; shows ▲/▼ on the active column. */
export function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  compact = false,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  /** Tighter padding for small dense tables. */
  compact?: boolean;
}) {
  const isActive = sortKey === activeKey;
  const base = 'cursor-pointer select-none whitespace-nowrap border-b border-slate-300 dark:border-slate-700 text-left font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100';
  const padding = compact ? 'px-2 py-1' : 'px-2.5 py-2';
  return (
    <th className={`${base} ${padding}`} onClick={() => onSort(sortKey)}>
      {label}
      {isActive && <span className="text-blue-600 dark:text-blue-400">{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  );
}

export interface SortOption {
  key: string;
  label: string;
}

/** Compact segmented control for sorting card grids / lists that have no column headers — same
 *  behaviour as `SortableHeader` (pick a key → ascending, pick the active key again → flip). */
export function SortButtons({ options, sort }: { options: SortOption[]; sort: SortState }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ordina per">
      <span className="mr-1 text-[0.78rem] text-slate-500">Ordina:</span>
      {options.map((option) => {
        const active = option.key === sort.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => sort.toggle(option.key)}
            aria-pressed={active}
            className={cn(
              'cursor-pointer rounded px-2 py-0.5 text-[0.78rem] font-semibold transition-colors',
              active
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {option.label}
            {active && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
          </button>
        );
      })}
    </div>
  );
}
