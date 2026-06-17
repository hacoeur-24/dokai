import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, Loader2, X } from 'lucide-react';
import { cn } from '../lib/cn.js';

type ToastKind = 'info' | 'success' | 'error' | 'loading';

interface ToastItem {
  id: string;
  message: ReactNode;
  kind: ToastKind;
  duration: number;
  /** Internal state used to drive the slide-out animation before unmount. */
  exiting: boolean;
}

export interface ToastApi {
  show: (input: { message: ReactNode; kind?: ToastKind; duration?: number; id?: string }) => string;
  update: (
    id: string,
    input: Partial<{ message: ReactNode; kind: ToastKind; duration: number }>,
  ) => void;
  dismiss: (id: string) => void;
  /**
   * Wrap a promise with a loading toast that morphs into success/error when the promise
   * settles. Returns the underlying promise so callers can still `await` it.
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: ReactNode;
      success: ReactNode | ((value: T) => ReactNode);
      error: ReactNode | ((err: unknown) => ReactNode);
    },
  ) => Promise<T>;
}

const ToastCtx = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastKind, number> = {
  info: 2500,
  success: 2500,
  error: 5000,
  loading: 0, // Loading toasts stay until the caller updates or dismisses them.
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((cur) => cur.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      // Mark as exiting → animate out → remove after the animation duration.
      setItems((cur) => cur.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => removeItem(id), 180);
    },
    [clearTimer, removeItem],
  );

  const scheduleDismiss = useCallback(
    (id: string, ms: number) => {
      clearTimer(id);
      if (ms > 0) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), ms),
        );
      }
    },
    [clearTimer, dismiss],
  );

  const show = useCallback<ToastApi['show']>(
    ({ message, kind = 'info', duration, id }) => {
      const finalId = id ?? `t${++counterRef.current}`;
      const finalDuration = duration ?? DEFAULT_DURATION[kind];
      setItems((cur) => {
        const without = cur.filter((t) => t.id !== finalId);
        return [
          ...without,
          {
            id: finalId,
            message,
            kind,
            duration: finalDuration,
            exiting: false,
          },
        ];
      });
      scheduleDismiss(finalId, finalDuration);
      return finalId;
    },
    [scheduleDismiss],
  );

  const update = useCallback<ToastApi['update']>(
    (id, input) => {
      setItems((cur) =>
        cur.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(input.message !== undefined ? { message: input.message } : {}),
                ...(input.kind !== undefined ? { kind: input.kind } : {}),
                ...(input.duration !== undefined ? { duration: input.duration } : {}),
                exiting: false,
              }
            : t,
        ),
      );
      if (input.duration !== undefined) {
        scheduleDismiss(id, input.duration);
      } else if (input.kind && input.kind !== 'loading') {
        scheduleDismiss(id, DEFAULT_DURATION[input.kind]);
      }
    },
    [scheduleDismiss],
  );

  const promise = useCallback<ToastApi['promise']>(
    (p, messages) => {
      const id = show({ message: messages.loading, kind: 'loading' });
      return p.then(
        (value) => {
          const msg =
            typeof messages.success === 'function' ? messages.success(value) : messages.success;
          update(id, { message: msg, kind: 'success' });
          return value;
        },
        (err: unknown) => {
          const msg = typeof messages.error === 'function' ? messages.error(err) : messages.error;
          update(id, { message: msg, kind: 'error' });
          throw err;
        },
      );
    },
    [show, update],
  );

  // Clear all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ show, update, dismiss, promise }}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed top-4 right-4 z-100 flex max-w-[20rem] flex-col gap-2"
    >
      {items.map((t) => (
        <ToastView key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = ICONS[item.kind];
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-card border bg-(--color-surface) px-3.5 py-2.5 text-[0.85rem] shadow-(--shadow-pop)',
        'will-change-transform',
        item.exiting ? 'dokai-toast-out' : 'dokai-toast-in',
      )}
      style={{
        borderColor:
          item.kind === 'error'
            ? 'color-mix(in oklch, var(--color-danger) 30%, var(--color-border))'
            : item.kind === 'success'
              ? 'color-mix(in oklch, var(--color-success) 30%, var(--color-border))'
              : 'var(--color-border)',
      }}
    >
      <Icon
        className={cn('mt-px h-4 w-4 shrink-0', item.kind === 'loading' && 'animate-spin')}
        style={{ color: ICON_COLORS[item.kind] }}
      />
      <div className="flex-1 leading-snug" style={{ color: 'var(--color-fg)' }}>
        {item.message}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        title="Dismiss"
        aria-label="Dismiss notification"
        className="-mr-1 -mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-fg-subtle transition hover:bg-bg-muted hover:text-fg"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
  loading: Loader2,
};

const ICON_COLORS: Record<ToastKind, string> = {
  info: 'var(--color-fg-muted)',
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  loading: 'var(--color-accent)',
};
