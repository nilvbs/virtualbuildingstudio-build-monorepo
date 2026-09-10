'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Ticket, X } from 'lucide-react';
import {
  HELP_TICKET_CATEGORIES,
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITIES,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicket,
  type HelpTicketAttachment,
  type HelpTicketCategory,
  type HelpTicketDetail,
  type HelpTicketPriority,
  type HelpTicketWorkspace,
} from '@surveylink/types';
import { toastError, toastLoading, toastSuccess } from '../lib/action-toast';
import { api, errorMessage } from '../lib/api';
import { HdSubmitButton } from './hd-submit-button';
import { HelpFaqSection } from './help-faq-section';
import { HelpFeedbackSection } from './help-feedback-section';

function TicketAttachments({
  items,
  onChange,
  disabled,
}: {
  items: HelpTicketAttachment[];
  onChange: (next: HelpTicketAttachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingUrlsRef = useRef<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewByUrl, setPreviewByUrl] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<
    { id: string; previewUrl: string; fileName: string; progress: number }[]
  >([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      for (const url of pendingUrlsRef.current) URL.revokeObjectURL(url);
      pendingUrlsRef.current = [];
    };
  }, []);

  async function uploadFiles(files: File[]) {
    const slots = Math.max(0, 5 - items.length - pending.length);
    const selected = files.slice(0, slots);
    if (!selected.length) return;

    const nextPending = selected.map((file, i) => {
      const previewUrl = URL.createObjectURL(file);
      pendingUrlsRef.current.push(previewUrl);
      return {
        id: `up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        previewUrl,
        fileName: file.name,
        progress: 8,
      };
    });
    setPending((prev) => [...prev, ...nextPending]);
    setUploading(true);
    setLocalError(null);

    const base = items;
    const uploaded: HelpTicketAttachment[] = [];
    try {
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i]!;
        const row = nextPending[i]!;
        const tick = window.setInterval(() => {
          setPending((prev) =>
            prev.map((p) =>
              p.id === row.id && p.progress < 88
                ? { ...p, progress: Math.min(88, p.progress + 6 + Math.random() * 8) }
                : p,
            ),
          );
        }, 180);

        try {
          const stored = await api.uploadMedia(file, 'document', file.name);
          const stableUrl = stored.url;
          const displayUrl = stored.signedUrl || stored.url;
          uploaded.push({
            url: stableUrl,
            fileName: stored.fileName || file.name,
            contentType: stored.contentType ?? file.type ?? null,
          });
          setPreviewByUrl((prev) => ({ ...prev, [stableUrl]: displayUrl }));
          setPending((prev) =>
            prev.map((p) => (p.id === row.id ? { ...p, progress: 100 } : p)),
          );
          onChange([...base, ...uploaded].slice(0, 5));
          await new Promise((r) => window.setTimeout(r, 220));
        } finally {
          window.clearInterval(tick);
          setPending((prev) => {
            const gone = prev.find((p) => p.id === row.id);
            if (gone) {
              URL.revokeObjectURL(gone.previewUrl);
              pendingUrlsRef.current = pendingUrlsRef.current.filter((u) => u !== gone.previewUrl);
            }
            return prev.filter((p) => p.id !== row.id);
          });
        }
      }
    } catch (err) {
      setLocalError(errorMessage(err));
      setPending((prev) => {
        for (const p of prev) {
          URL.revokeObjectURL(p.previewUrl);
          pendingUrlsRef.current = pendingUrlsRef.current.filter((u) => u !== p.previewUrl);
        }
        return [];
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeAttachment(target: HelpTicketAttachment) {
    if (disabled || uploading || removingUrl) return;
    setRemovingUrl(target.url);
    setLocalError(null);
    onChange(items.filter((x) => x.url !== target.url));
    setPreviewByUrl((prev) => {
      const next = { ...prev };
      delete next[target.url];
      return next;
    });
    try {
      await api.deleteMedia({ url: target.url });
    } catch (err) {
      // Keep it removed from the form; surface the storage error.
      setLocalError(errorMessage(err));
    } finally {
      setRemovingUrl(null);
    }
  }

  function onPick(files: FileList | null) {
    if (!files?.length) return;
    void uploadFiles(Array.from(files));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading || items.length >= 5) return;
    void uploadFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')));
  }

  const full = items.length + pending.length >= 5;

  return (
    <div
      className={`hd-attach${dragOver ? ' is-drag' : ''}${uploading ? ' is-uploading' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled && !full) setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="hd-attach-row">
        <button
          type="button"
          className={`btn secondary hd-attach-btn${uploading ? ' is-loading' : ''}`}
          disabled={disabled || uploading || full}
          onClick={() => inputRef.current?.click()}
        >
          <span className="hd-attach-btn-shine" aria-hidden />
          {uploading ? (
            <span className="hd-attach-btn-spin" aria-hidden />
          ) : (
            <ImagePlus size={16} className="hd-attach-btn-ico" />
          )}
          <span>{uploading ? 'Uploading' : 'Add images'}</span>
          {uploading ? (
            <span className="hd-submit-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </button>
        <span className="hd-attach-hint">
          {uploading
            ? `Sending ${pending.length || 1} image${pending.length === 1 ? '' : 's'}…`
            : 'Up to 5 images · drag & drop or browse'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => onPick(e.target.files)}
        />
      </div>
      {localError ? <div className="alert error">{localError}</div> : null}
      {items.length > 0 || pending.length > 0 ? (
        <ul className="hd-attach-list">
          {items.map((a) => (
            <li
              key={a.url}
              className={`hd-attach-item is-ready${removingUrl === a.url ? ' is-removing' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewByUrl[a.url] || a.url}
                alt={a.fileName}
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.opacity = '0.35';
                }}
              />
              <button
                type="button"
                className="hd-attach-remove"
                aria-label={`Remove ${a.fileName}`}
                disabled={disabled || uploading || removingUrl === a.url}
                onClick={() => void removeAttachment(a)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="hd-attach-item is-pending" aria-busy="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`Uploading ${p.fileName}`} />
              <div className="hd-attach-overlay">
                <span
                  className="hd-attach-ring"
                  style={{ ['--p' as string]: String(Math.round(p.progress)) }}
                  aria-hidden
                />
                <em>{Math.round(p.progress)}%</em>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          className="hd-attach-drop"
          disabled={disabled || uploading || full}
          onClick={() => inputRef.current?.click()}
        >
          <span className="hd-attach-drop-pulse" aria-hidden />
          <ImagePlus size={18} />
          <span>Drop screenshots here</span>
        </button>
      )}
    </div>
  );
}

function MessageAttachments({ items }: { items: HelpTicketAttachment[] }) {
  if (!items.length) return null;
  return (
    <ul className="hd-msg-attach">
      {items.map((a) => (
        <li key={a.url}>
          <a href={a.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.fileName} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function HelpDeskWorkspace({ workspace }: { workspace: HelpTicketWorkspace }) {
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [selected, setSelected] = useState<HelpTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [category, setCategory] = useState<HelpTicketCategory>('account');
  const [priority, setPriority] = useState<HelpTicketPriority>('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<HelpTicketAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<HelpTicketAttachment[]>([]);

  useEffect(() => setMounted(true), []);

  function onCategoryChange(next: HelpTicketCategory) {
    setCategory(next);
    if (next === 'blocker') {
      setPriority((p) => (p === 'low' || p === 'normal' ? 'urgent' : p));
    }
  }

  function resetTicketForm() {
    setCategory('account');
    setPriority('normal');
    setSubject('');
    setBody('');
    setAttachments([]);
  }

  function openNewTicket() {
    setSelected(null);
    setError(null);
    setShowForm(true);
    requestAnimationFrame(() => setFormVisible(true));
  }

  function closeNewTicket() {
    setFormVisible(false);
    window.setTimeout(() => {
      setShowForm(false);
      resetTicketForm();
    }, 280);
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

  useEffect(() => {
    if (!showForm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeNewTicket();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showForm]);

  async function openTicket(id: string) {
    setError(null);
    try {
      const detail = await api.getMyHelpTicket(id);
      setSelected(detail);
      if (showForm) closeNewTicket();
      setReply('');
      setReplyAttachments([]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const toastId = toastLoading(
      category === 'blocker' ? 'Submitting blocker…' : 'Submitting ticket…',
      'Hang tight — we’re opening your request.',
    );
    try {
      const detail = await api.createHelpTicket({
        workspace,
        category,
        priority,
        subject,
        body,
        attachments,
      });
      toastSuccess(
        'Ticket submitted',
        `${detail.ticketNumber} is open — we’ll reply in this thread.`,
        toastId,
      );
      resetTicketForm();
      setFormVisible(false);
      setShowForm(false);
      await refresh();
      setSelected(detail);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toastError('Couldn’t submit ticket', msg, toastId);
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (selected.status === 'resolved' || selected.status === 'closed') {
      setError(
        selected.status === 'resolved'
          ? 'This ticket is resolved — messaging is locked.'
          : 'This ticket is closed — messaging is locked.',
      );
      return;
    }
    if (reply.trim().length < 2 && replyAttachments.length === 0) {
      setError('Add a message or at least one image.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detail = await api.replyHelpTicket(selected.id, {
        body: reply.trim(),
        attachments: replyAttachments,
      });
      setReply('');
      setReplyAttachments([]);
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

  const ticketDrawer =
    showForm && mounted
      ? createPortal(
          <div
            className={`hd-drawer-root${formVisible ? ' is-open' : ''}`}
            role="presentation"
          >
            <button
              type="button"
              className="hd-drawer-backdrop"
              aria-label="Close new ticket"
              onClick={closeNewTicket}
            />
            <aside
              className="hd-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="New support ticket"
            >
              <header className="hd-drawer-head">
                <div className="hd-drawer-brand">
                  <span className="hd-drawer-ico" aria-hidden>
                    <Ticket size={18} />
                  </span>
                  <div>
                    <p className="fb-kicker">Help desk</p>
                    <h2>New support ticket</h2>
                    <p className="hd-drawer-sub">
                      Tell us what’s going on — including blockers when you can’t proceed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="hd-drawer-close"
                  aria-label="Close"
                  onClick={closeNewTicket}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="hd-drawer-body">
                {error ? <div className="alert error">{error}</div> : null}
                <form
                  className={`hd-form hd-form--drawer${busy ? ' is-sending is-sending--ticket' : ''}`}
                  onSubmit={submitTicket}
                >
                  {category === 'blocker' ? (
                    <p className="hd-blocker-note">
                      Blocker tickets are prioritized. Describe what’s stuck and what you need to
                      proceed — we’ll continue the conversation in this thread.
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
                  <TicketAttachments items={attachments} onChange={setAttachments} disabled={busy} />
                  <div className="hd-form-actions">
                    <button
                      type="button"
                      className="btn secondary hd-cancel-btn"
                      onClick={closeNewTicket}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <HdSubmitButton
                      variant="ticket"
                      busy={busy}
                      idleLabel={
                        category === 'blocker' ? 'Submit blocker ticket' : 'Submit ticket'
                      }
                      busyLabel="Launching"
                    />
                  </div>
                </form>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="hd-wrap">
      <div className="hd-toolbar">
        <button type="button" className="btn primary" onClick={openNewTicket}>
          New ticket
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {ticketDrawer}

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
                    {m.body.trim() ? <p>{m.body}</p> : null}
                    <MessageAttachments items={m.attachments ?? []} />
                  </article>
                ))}
              </div>
              {selected.status !== 'closed' && selected.status !== 'resolved' ? (
                <form className="hd-reply" onSubmit={sendReply}>
                  <textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add more detail or reply to support…"
                    minLength={replyAttachments.length ? 0 : 2}
                  />
                  <TicketAttachments
                    items={replyAttachments}
                    onChange={setReplyAttachments}
                    disabled={busy}
                  />
                  <button type="submit" className="btn primary" disabled={busy}>
                    {busy ? 'Sending…' : 'Send reply'}
                  </button>
                </form>
              ) : (
                <p className="hd-empty">
                  {selected.status === 'resolved'
                    ? 'This ticket is resolved — messaging is locked.'
                    : 'This ticket is closed — messaging is locked.'}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <HelpFaqSection workspace={workspace} />
      <HelpFeedbackSection workspace={workspace} />
    </div>
  );
}
