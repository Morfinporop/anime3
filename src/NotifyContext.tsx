import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckIcon, CloseIcon, AlertIcon } from './components/icons';

export type NotifyType = 'success' | 'error' | 'info';

interface NotifyItem {
  id: number;
  type: NotifyType;
  title?: string;
  message: string;
}

interface NotifyContextValue {
  notify: (message: string, type?: NotifyType, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const NotifyContext = createContext<NotifyContextValue | null>(null);

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotifyItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const notify = useCallback((message: string, type: NotifyType = 'info', title?: string) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, type, message, title }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value: NotifyContextValue = {
    notify,
    success: (m, t) => notify(m, 'success', t),
    error: (m, t) => notify(m, 'error', t),
    info: (m, t) => notify(m, 'info', t),
  };

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6">
        {items.map(item => (
          <div
            key={item.id}
            className="pointer-events-auto inline-flex items-center gap-3 bg-zinc-900 text-white shadow-2xl shadow-black/40 rounded-full pl-2 pr-2 py-2 animate-slide-down"
            style={{ animation: 'slide-down 0.25s ease-out' }}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                item.type === 'success' && "bg-emerald-500",
                item.type === 'error' && "bg-red-500",
                item.type === 'info' && "bg-zinc-700"
              )}
            >
              {item.type === 'success' && <CheckIcon className="w-4 h-4 text-white" />}
              {item.type === 'error' && <CloseIcon className="w-4 h-4 text-white" />}
              {item.type === 'info' && <AlertIcon className="w-4 h-4 text-white" />}
            </div>

            <div className="text-sm font-medium whitespace-nowrap pl-1 pr-2 text-white">
              {item.message}
            </div>

            <button
              onClick={() => remove(item.id)}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Закрыть"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify must be used within NotifyProvider');
  return ctx;
}
