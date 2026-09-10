'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  HELP_TICKET_CATEGORIES,
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITIES,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicket,
  type HelpTicketCategory,
  type HelpTicketDetail,
  type HelpTicketPriority,
  type HelpTicketWorkspace,
} from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { HelpFaqSection } from './help-faq-section';
import { HelpFeedbackSection } from './help-feedback-section';

export function HelpDeskWorkspace({ workspace }: { workspace: HelpTicketWorkspace }) {
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [selected, setSelected] = useState<HelpTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState<HelpTicketCategory>('account');
  const [priority, setPriority] = useState<HelpTicketPriority>('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  function onCategoryChange(next: HelpTicketCategory) {
    setCategory(next);
    if (next === 'blocker') {
      setPriority((p) => (p === 'low' || p === 'normal' ? 'urgent' : p));
    }
  }

  const refresh = useCallback(async () => {
    const rows = await api.listMyHelpTickets();
    setTickets(rows);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function openTicket(id: string) {
    setError(null);
    try {
      const detail = await api.getMyHelpTicket(id);
      setSelected(detail);
      setShowForm(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const detail = await api.createHelpTicket({
        workspace,
        category,
        priority,
        subject,
        body,
      });
      setSubject('');
      setBody('');
      setShowForm(false);
      await refresh();
      setSelected(detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await api.replyHelpTicket(selected.id, reply);
      setReply('');
      setSelected(detail);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="hd-wrap">
        <div className="skeleton sk-line" style={{ width: 180, height: 28 }} />
        <div className="skeleton" style={{ marginTop: 16, minHeight: 200, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div className="hd-wrap">
      <div className="hd-toolbar">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setShowForm(true);
            setSelected(null);
          }}
        >
          New ticket
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {showForm && (
        <form className="hd-form" onSubmit={submitTicket}>
          <h2>New support ticket</h2>
          {category === 'blocker' ? (
            <p className="hd-blocker-note">
              Blocker tickets are prioritized. Describe what’s stuck and what you need to proceed —
              we’ll continue the conversation in this thread.
            </p>
          ) : null}
          <label>
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value as HelpTicketCategory)}
            >
              {HELP_TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {HELP_TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as HelpTicketPriority)}
            >
              {HELP_TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {HELP_TICKET_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                category === 'blocker'
                  ? 'What’s blocked? (e.g. can’t accept request / matching stuck)'
                  : 'Short summary of the issue'
              }
              required
              minLength={4}
              maxLength={160}
            />
          </label>
          <label>
            <span>Details</span>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                category === 'blocker'
                  ? 'What you tried, where you’re stuck, and any project / match IDs…'
                  : 'What happened, what you expected, and any project or match details…'
              }
              required
              minLength={10}
              maxLength={4000}
            />
          </label>
          <div className="hd-form-actions">
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Sending…' : category === 'blocker' ? 'Submit blocker ticket' : 'Submit ticket'}
            </button>
          </div>
        </form>
      )}

      {/* 1. Your tickets */}
      <div className="hd-grid">
        <section className="hd-list-panel">
          <h2>Your tickets</h2>
          {tickets.length === 0 ? (
            <p className="hd-empty">No tickets yet. Open one if something needs attention.</p>
          ) : (
            <ul className="hd-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`hd-list-item ${selected?.id === t.id ? 'is-active' : ''}`}
                    onClick={() => openTicket(t.id)}
                  >
                    <span className="hd-list-top">
                      <strong>{t.ticketNumber}</strong>
                      <span className="hd-list-pills">
                        {t.category === 'blocker' ? (
                          <span className="hd-pill hd-pill--blocker">Blocker</span>
                        ) : null}
                        <span className={`hd-pill hd-pill--${t.status}`}>
                          {HELP_TICKET_STATUS_LABELS[t.status]}
                        </span>
                      </span>
                    </span>
                    <span className="hd-list-subject">{t.subject}</span>
                    <span className="hd-list-meta">
                      {HELP_TICKET_CATEGORY_LABELS[t.category]} ·{' '}
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hd-detail-panel">
          {!selected ? (
            <p className="hd-empty">Select a ticket to read the thread.</p>
          ) : (
            <>
              <header className="hd-detail-head">
                <div>
                  <p className="hd-detail-num">{selected.ticketNumber}</p>
                  <h2>{selected.subject}</h2>
                  <p className="hd-list-meta">
                    {HELP_TICKET_CATEGORY_LABELS[selected.category]} ·{' '}
                    {HELP_TICKET_PRIORITY_LABELS[selected.priority]} ·{' '}
                    {HELP_TICKET_STATUS_LABELS[selected.status]}
                  </p>
                </div>
              </header>
              <div className="hd-thread">
                {selected.messages.map((m) => (
                  <article
                    key={m.id}
                    className={`hd-msg ${m.isStaff ? 'is-staff' : 'is-user'}`}
                  >
                    <header>
                      <strong>
                        {m.isStaff
                          ? 'BLD Support'
                          : m.authorFullName || m.authorUsername || 'You'}
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
              {selected.status !== 'closed' ? (
                <form className="hd-reply" onSubmit={sendReply}>
                  <textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add more detail or reply to support…"
                    required
                    minLength={2}
                  />
                  <button type="submit" className="btn primary" disabled={busy}>
                    {busy ? 'Sending…' : 'Send reply'}
                  </button>
                </form>
              ) : (
                <p className="hd-empty">This ticket is closed.</p>
              )}
            </>
          )}
        </section>
      </div>

      {/* 2. FAQs */}
      <HelpFaqSection workspace={workspace} />

      {/* 3. Feedback form */}
      <HelpFeedbackSection workspace={workspace} />
    </div>
  );
}
