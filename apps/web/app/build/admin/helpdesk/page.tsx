'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  Clock3,
  Headset,
  Inbox,
  MessageSquare,
  TriangleAlert,
} from 'lucide-react';
import {
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUSES,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicket,
  type HelpTicketStatus,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AdminHelpdeskPage() {
  const router = useRouter();
  const [rows, setRows] = useState<HelpTicket[] | null>(null);
  const [filter, setFilter] = useState<'all' | HelpTicketStatus>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listAdminHelpTickets()
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  const counts = useMemo(() => {
    const base = {
      all: rows?.length ?? 0,
      open: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
      urgent: 0,
    };
    for (const r of rows ?? []) {
      base[r.status] += 1;
      if (r.priority === 'urgent' || r.priority === 'high') base.urgent += 1;
    }
    return base;
  }, [rows]);

  const visible = useMemo(() => {
    if (!rows) return [];
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  if (loading) {
    return (
      <div className="hd-admin">
        <div className="skeleton sk-line" style={{ width: 220, height: 28 }} />
        <div className="hd-admin-stats">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="hd-admin-stat skeleton" style={{ minHeight: 88 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!rows) return null;

  return (
    <div className="hd-admin">
      <header className="hd-admin-head">
        <div>
          <p className="ops-kicker">Operations</p>
          <h1>Help desk</h1>
          <p>Inbox for client and surveyor support — triage, reply, and close the loop.</p>
        </div>
      </header>

      <div className="hd-admin-stats">
        <article className="hd-admin-stat">
          <span className="hd-admin-stat-ico" aria-hidden>
            <Inbox size={16} />
          </span>
          <div>
            <strong>{counts.open + counts.in_progress}</strong>
            <span>Needs attention</span>
          </div>
        </article>
        <article className="hd-admin-stat">
          <span className="hd-admin-stat-ico" aria-hidden>
            <Clock3 size={16} />
          </span>
          <div>
            <strong>{counts.waiting}</strong>
            <span>Waiting on user</span>
          </div>
        </article>
        <article className="hd-admin-stat">
          <span className="hd-admin-stat-ico" aria-hidden>
            <MessageSquare size={16} />
          </span>
          <div>
            <strong>{counts.resolved + counts.closed}</strong>
            <span>Resolved / closed</span>
          </div>
        </article>
        <article className="hd-admin-stat hd-admin-stat--warn">
          <span className="hd-admin-stat-ico" aria-hidden>
            <TriangleAlert size={16} />
          </span>
          <div>
            <strong>{counts.urgent}</strong>
            <span>High / urgent</span>
          </div>
        </article>
      </div>

      <div className="hd-admin-toolbar">
        <div className="hd-admin-filters" role="tablist" aria-label="Filter by status">
          <button
            type="button"
            className={`hd-chip ${filter === 'all' ? 'is-on' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <em>{counts.all}</em>
          </button>
          {HELP_TICKET_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`hd-chip ${filter === s ? 'is-on' : ''}`}
              onClick={() => setFilter(s)}
            >
              {HELP_TICKET_STATUS_LABELS[s]} <em>{counts[s]}</em>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="hd-admin-empty">
          <div className="empty-ico">
            <Headset size={22} />
          </div>
          <h2>No tickets here</h2>
          <p>Nothing matches this filter. New tickets from Help land in Open.</p>
        </div>
      ) : (
        <div className="hd-admin-table-wrap">
          <table className="hd-admin-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Requester</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updated</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/build/admin/helpdesk/${t.id}`} className="hd-admin-ticket-link">
                      <span className="hd-admin-ticket-id">{t.ticketNumber}</span>
                      <strong>{t.subject}</strong>
                      {t.latestMessagePreview ? (
                        <span className="hd-admin-ticket-preview">{t.latestMessagePreview}</span>
                      ) : null}
                    </Link>
                  </td>
                  <td>
                    <div className="hd-admin-person">
                      <span className="hd-admin-avatar" aria-hidden>
                        {(t.requesterFullName ?? t.requesterUsername ?? '?')
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                      <div>
                        <strong>{t.requesterFullName ?? t.requesterUsername ?? '—'}</strong>
                        <span>
                          {t.workspace}
                          {t.messageCount ? ` · ${t.messageCount} msg` : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="hd-admin-cat">{HELP_TICKET_CATEGORY_LABELS[t.category]}</span>
                  </td>
                  <td>
                    <span className={`hd-pill hd-pill--prio-${t.priority}`}>
                      {HELP_TICKET_PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td>
                    <span className={`hd-pill hd-pill--${t.status}`}>
                      {HELP_TICKET_STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td>
                    <time dateTime={t.updatedAt}>{relativeTime(t.updatedAt)}</time>
                  </td>
                  <td className="hd-admin-open">
                    <Link
                      href={`/build/admin/helpdesk/${t.id}`}
                      className="hd-admin-open-btn"
                      aria-label={`Open ${t.ticketNumber}`}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
