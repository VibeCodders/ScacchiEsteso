import { cn } from '../../lib/cn';
import type { Toast, ToastType } from './useToasts';

const TOAST_CLASSES: Record<ToastType, string> = {
  success: 'border-emerald-400 dark:border-emerald-500 bg-emerald-100 dark:bg-emerald-900',
  info: 'border-blue-400 dark:border-blue-500 bg-sky-100 dark:bg-sky-950',
  warning: 'border-amber-400 dark:border-amber-500 bg-amber-100 dark:bg-amber-950',
  error: 'border-red-400 dark:border-red-500 bg-red-100 dark:bg-red-950',
};

/** Fixed bottom-right stack of toasts. */
export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn('max-w-[400px] rounded-lg border px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200', TOAST_CLASSES[toast.type])}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
