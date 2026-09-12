'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITIES,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUSES,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicketDetail,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';

export default function AdminHelpdeskTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState<HelpTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    api
      .getAdminHelpTicket(id)
      .then(setTicket)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      });
  }, [id, router]);

  async function patch(partial: { status?: HelpTicketStatus; priority?: HelpTicketPriority }) {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.updateAdminHelpTicket(ticket.id, partial);
      setTicket(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.replyAdminHelpTicket(ticket.id, reply);
      setReply('');
      setTicket(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !ticket) return <div className="alert error">{error}</div>;
  if (!ticket) {
    return (
      <div className="hd-admin">
        <div className="skeleton sk-line" style={{ width: 200, height: 24 }} />
        <div className="skeleton" style={{ marginTop: 16, minHeight: 220, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div className="hd-admin">
      <Link href="/build/admin/helpdesk" className="plain hd-back">
        <ArrowLeft size={15} /> All tickets
      </Link>

      <header className="hd-admin-ticket-head">
        <div>
          <p className="ops-kicker">{ticket.ticketNumber}</p>
          <h1>{ticket.subject}</h1>
          <p>
            {ticket.workspace} · {ticket.requesterFullName} ({ticket.requesterEmail}) ·{' '}
            {HELP_TICKET_CATEGORY_LABELS[ticket.category]}
          </p>
        </div>
        <div className="hd-admin-controls">
          <label>
            Status
            <select
              value={ticket.status}
              disabled={busy}
              onChange={(e) => patch({ status: e.target.value as HelpTicketStatus })}
            >
              {HELP_TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {HELP_TICKET_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={ticket.priority}
              disabled={busy}
              onChange={(e) => patch({ priority: e.target.value as HelpTicketPriority })}
            >
              {HELP_TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {HELP_TICKET_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="hd-thread hd-thread--admin">
        {ticket.messages.map((m) => (
          <article key={m.id} className={`hd-msg ${m.isStaff ? 'is-staff' : 'is-user'}`}>
            <header>
              <strong>
                {m.isStaff ? 'Support' : m.authorFullName || m.authorUsername || 'User'}
              </strong>
              <time dateTime={m.createdAt}>
                {new Date(m.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </header>
            <p>{m.body}</p>
          </article>
        ))}
      </div>

      <form className="hd-reply" onSubmit={sendReply}>
        <textarea
          rows={4}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to the requester…"
          required
          minLength={2}
        />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send reply'}
        </button>
      </form>
    </div>
  );
}
