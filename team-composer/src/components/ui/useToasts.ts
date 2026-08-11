import { useCallback, useState } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  message: string;
  type: ToastType;
  id: number;
}

/** Auto-expiring toast state + push helper (extracted from the team composer). */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);
  return { toasts, addToast };
}
