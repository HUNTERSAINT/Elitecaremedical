import { useState, useCallback, type ReactNode } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: ReactNode;
}

// Singleton state for toasts (simple implementation)
let toastListeners: Array<(toasts: Toast[]) => void> = [];
let currentToasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach(fn => fn([...currentToasts]));
}

export function toast(t: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  currentToasts = [...currentToasts, { ...t, id }];
  notifyListeners();
  setTimeout(() => {
    currentToasts = currentToasts.filter(x => x.id !== id);
    notifyListeners();
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(currentToasts);

  const subscribe = useCallback((fn: (t: Toast[]) => void) => {
    toastListeners.push(fn);
    return () => {
      toastListeners = toastListeners.filter(l => l !== fn);
    };
  }, []);

  useState(() => {
    const unsub = subscribe(setToasts);
    return unsub;
  });

  return {
    toasts,
    toast: (t: Omit<Toast, 'id'>) => toast(t),
    dismiss: (id: string) => {
      currentToasts = currentToasts.filter(x => x.id !== id);
      notifyListeners();
    },
  };
}
