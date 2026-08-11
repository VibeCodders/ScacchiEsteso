import type { LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Shared class for text/number/select inputs across all forms. */
export const inputClass =
  'rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-40';

interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: ReactNode;
}

/** Vertical labeled field — the form pattern used by the settings and piece-designer screens. */
function Field({ label, className, children, ...rest }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs text-slate-400', className)} {...rest}>
      {label}
      {children}
    </label>
  );
}

export default Field;
