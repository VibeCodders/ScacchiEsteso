import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'auto' | 'improve' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * The app's only button — every `btn-save`/`btn-reset`/`btn-auto`/`btn-improve` from the old
 * stylesheet becomes a variant here. The legacy class names are kept on the element (harmless,
 * and a few tests still select `.btn-save` for the promotion/revival choosers).
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-save bg-blue-700 text-white hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:hover:bg-slate-700',
  secondary: 'btn-reset bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600',
  auto: 'btn-auto bg-teal-600 text-white hover:bg-teal-700',
  improve: 'btn-improve bg-violet-600 text-white hover:bg-violet-700',
  danger: 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60',
  ghost: 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700',
};

const BASE_CLASSES =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], className)} {...rest} />;
}

export default Button;
