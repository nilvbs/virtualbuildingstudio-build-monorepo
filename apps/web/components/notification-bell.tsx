'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import type { Notification } from '@surveylink/types';
import { api } from '../lib/api';
import { isAuthenticated } from '../lib/session';
import {
  notificationBelongsToWorkspace,
  resolveWorkspaceNotificationLink,
  type MarketplaceSection,
} from '../lib/notification-scope';

const POLL_MS = 15_000;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Header inbox for client + surveyor.
 * Only shows / opens notifications for the active workspace role.
 */
export function NotificationBell({ section }: { section: MarketplaceSection }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;

    async function poll() {
      if (!isAuthenticated()) return;
      try {
        const rows = await api.getNotifications();
        if (cancelled) return;
        setItems(rows.filter((n) => notificationBelongsToWorkspace(n, section)));
      } catch {
        /* ignore */
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [section]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const unread = items.filter((n) => !n.readAt);
  const unreadCount = unread.length;

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      try {
        const updated = await api.markNotificationRead(n.id);
        setItems((prev) => prev.map((row) => (row.id === n.id ? updated : row)));
      } catch {
        /* ignore */
      }
    }
    router.push(resolveWorkspaceNotificationLink(n.linkUrl, section));
  }

  async function markAllRead() {
    const pending = unread.slice(0, 20);
    await Promise.allSettled(pending.map((n) => api.markNotificationRead(n.id)));
    try {
      const rows = await api.getNotifications();
      setItems(rows.filter((n) => notificationBelongsToWorkspace(n, section)));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className={`notif-bell-trigger${unreadCount > 0 ? ' has-unread' : ''}`}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} strokeWidth={2.2} />
        {unreadCount > 0 ? (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-bell-panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell-head">
            <strong>Notifications</strong>
            {unreadCount > 0 ? (
              <button type="button" className="notif-bell-mark" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="notif-bell-empty">No notifications for this workspace yet.</p>
          ) : (
            <ul className="notif-bell-list">
              {items.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-bell-item${!n.readAt ? ' is-unread' : ''}`}
                    onClick={() => void openItem(n)}
                  >
                    <span className="notif-bell-item-title">{n.title}</span>
                    {n.body ? <span className="notif-bell-item-body">{n.body}</span> : null}
                    <span className="notif-bell-item-time">{relativeTime(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
