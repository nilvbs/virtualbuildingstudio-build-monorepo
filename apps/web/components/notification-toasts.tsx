'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Notification } from '@surveylink/types';
import { api } from '../lib/api';
import { isAuthenticated } from '../lib/session';
import {
  notificationBelongsToWorkspace,
  resolveWorkspaceNotificationLink,
  type WorkspaceSection,
} from '../lib/notification-scope';

const POLL_MS = 20_000;
const AUTO_DISMISS_MS = 12_000;

function seenKey(section: WorkspaceSection): string {
  return `bld.notifications.seen.${section}`;
}

function loadSeen(section: WorkspaceSection): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(seenKey(section));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistSeen(section: WorkspaceSection, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  const trimmed = [...ids].slice(-80);
  sessionStorage.setItem(seenKey(section), JSON.stringify(trimmed));
}

/**
 * Bottom-right toast stack — only toasts for the active workspace role.
 */
export function NotificationToasts({ section }: { section: WorkspaceSection }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Notification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    seenRef.current = loadSeen(section);
    setToasts([]);
  }, [section]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    let cancelled = false;

    async function poll() {
      if (!isAuthenticated()) return;
      try {
        const rows = await api.getNotifications();
        if (cancelled) return;

        const fresh = rows.filter(
          (n) =>
            !n.readAt &&
            !seenRef.current.has(n.id) &&
            notificationBelongsToWorkspace(n, section),
        );
        if (fresh.length === 0) return;

        for (const n of fresh) seenRef.current.add(n.id);
        persistSeen(section, seenRef.current);

        setToasts((prev) => {
          const existing = new Set(prev.map((t) => t.id));
          const next = [...fresh.filter((n) => !existing.has(n.id)), ...prev].slice(0, 4);
          return next;
        });
      } catch {
        /* ignore transient poll errors */
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, [section]);

  useEffect(() => {
    for (const toast of toasts) {
      if (timersRef.current.has(toast.id)) continue;
      const timer = setTimeout(() => {
        dismiss(toast.id, false);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(toast.id, timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss is stable enough via refs
  }, [toasts]);

  function dismiss(id: string, markRead: boolean) {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (markRead) {
      void api.markNotificationRead(id).catch(() => undefined);
    }
  }

  function openToast(n: Notification) {
    dismiss(n.id, true);
    router.push(resolveWorkspaceNotificationLink(n.linkUrl, section));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="bld-toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((n) => (
        <article key={n.id} className="bld-toast" role="status">
          <button type="button" className="bld-toast-body" onClick={() => openToast(n)}>
            <span className="bld-toast-title">{n.title}</span>
            {n.body ? <span className="bld-toast-copy">{n.body}</span> : null}
            <span className="bld-toast-cta">View</span>
          </button>
          <button
            type="button"
            className="bld-toast-close"
            aria-label="Dismiss notification"
            onClick={() => dismiss(n.id, true)}
          >
            <X size={14} />
          </button>
        </article>
      ))}
    </div>
  );
}
