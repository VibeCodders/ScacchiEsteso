import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Elements that can receive keyboard focus inside the modal. */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  title: string;
  /** Called on Escape and on a click of the dimmed backdrop. Omit to make the modal non-dismissible. */
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Reusable modal dialog: dimmed full-screen backdrop with a centered card, initial focus on the
 * first focusable element, a focus trap (Tab/Shift+Tab cycle inside), and Escape/backdrop-click
 * dismissal when `onClose` is provided. On unmount, focus is restored to whatever had it before
 * the modal opened.
 */
function Modal({ title, onClose, className, children }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const container = containerRef.current;
    const focusables = container
      ? [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => !el.hasAttribute('disabled'))
      : [];
    (focusables[0] ?? container)?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const container = containerRef.current;
    if (!container) return;
    const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      .filter((el) => !el.hasAttribute('disabled'));
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose?.();
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/85 p-4"
      onKeyDown={handleKeyDown}
      onMouseDown={handleBackdropMouseDown}
    >
      <div className={cn('w-full max-w-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl', className)}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
        <div className="mt-4 flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
