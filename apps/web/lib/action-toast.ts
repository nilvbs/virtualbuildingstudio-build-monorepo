export type ActionToastKind = 'loading' | 'success' | 'error';

export type ActionToast = {
  id: string;
  kind: ActionToastKind;
  title: string;
  body?: string;
  createdAt: number;
};

type Listener = (toasts: ActionToast[]) => void;

let toasts: ActionToast[] = [];
const listeners = new Set<Listener>();
const dismissTimers = new Map<string, number>();

function emit() {
  const snapshot = toasts.slice();
  for (const listener of listeners) listener(snapshot);
}

function uid() {
  return `at-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clearTimer(id: string) {
  const t = dismissTimers.get(id);
  if (t != null) {
    window.clearTimeout(t);
    dismissTimers.delete(id);
  }
}

function scheduleAutoDismiss(id: string, ms: number) {
  clearTimer(id);
  dismissTimers.set(
    id,
    window.setTimeout(() => {
      dismissActionToast(id);
    }, ms),
  );
}

export function subscribeActionToasts(listener: Listener) {
  listeners.add(listener);
  listener(toasts.slice());
  return () => {
    listeners.delete(listener);
  };
}

export function dismissActionToast(id: string) {
  clearTimer(id);
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function upsertToast(input: {
  id?: string;
  replaceId?: string;
  kind: ActionToastKind;
  title: string;
  body?: string;
  durationMs?: number | null;
}): string {
  const id = input.replaceId || input.id || uid();
  clearTimer(id);
  const entry: ActionToast = {
    id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    createdAt: Date.now(),
  };
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx >= 0) {
    toasts = [...toasts.slice(0, idx), entry, ...toasts.slice(idx + 1)];
  } else {
    toasts = [...toasts, entry];
  }
  emit();

  const duration =
    input.durationMs === undefined
      ? input.kind === 'loading'
        ? null
        : 4200
      : input.durationMs;
  if (duration != null) scheduleAutoDismiss(id, duration);
  return id;
}

export function toastLoading(title: string, body?: string, replaceId?: string) {
  return upsertToast({ replaceId, kind: 'loading', title, body, durationMs: null });
}

export function toastSuccess(title: string, body?: string, replaceId?: string) {
  return upsertToast({ replaceId, kind: 'success', title, body });
}

export function toastError(title: string, body?: string, replaceId?: string) {
  return upsertToast({ replaceId, kind: 'error', title, body, durationMs: 5600 });
}
