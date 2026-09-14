'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareHeart, X } from 'lucide-react';
import { FEEDBACK_RATING_EMOJIS } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';

type Props = {
  open: boolean;
  source?: 'landing' | 'support';
  onClose: () => void;
};

export function LandingFeedbackOverlay({ open, source = 'landing', onClose }: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRating(null);
    setName('');
    setEmail('');
    setMessage('');
    setCompany('');
    setError(null);
    setDone(false);
    setBusy(false);
  }, [open]);

  function close() {
    setVisible(false);
    window.setTimeout(onClose, 280);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!rating) {
      setError('Pick a rating to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submitSiteFeedback({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        rating,
        message: message.trim(),
        source,
        company: company || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className={`bld-fb-overlay${visible ? ' is-open' : ''}`} role="presentation">
      <button type="button" className="bld-fb-backdrop" aria-label="Close feedback" onClick={close} />
      <aside
        className="bld-fb-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="bld-fb-panel-inner">
          <header className="bld-fb-head">
            <div>
              <p className="bld-fb-kicker">Product feedback</p>
              <h2 id={titleId} className="bld-fb-title">
                How’s BLD feeling?
              </h2>
            </div>
            <button type="button" className="bld-fb-close" onClick={close} aria-label="Close">
              <X size={18} strokeWidth={2.25} />
            </button>
          </header>

          {done ? (
            <div className="bld-fb-done">
              <span className="bld-fb-done-emoji" aria-hidden>
                🤩
              </span>
              <p>Thanks — your note is with the team.</p>
              <button type="button" className="bld-btn bld-btn--primary" onClick={close}>
                Close
              </button>
            </div>
          ) : (
            <form className="bld-fb-form" onSubmit={onSubmit}>
              <p className="bld-fb-lede">
                Tell us what works, what’s rough, or what you’d love next. No account needed.
              </p>

              <fieldset className="bld-fb-ratings">
                <legend>Overall</legend>
                <div className="bld-fb-rating-row" role="radiogroup" aria-label="Rating">
                  {([1, 2, 3, 4, 5] as const).map((n) => {
                    const meta = FEEDBACK_RATING_EMOJIS[n];
                    const active = rating === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${n}: ${meta.label}`}
                        className={`bld-fb-rate${active ? ' is-active' : ''}`}
                        onClick={() => setRating(n)}
                      >
                        <span aria-hidden>{meta.emoji}</span>
                        <small>{meta.label}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="bld-fb-field">
                <span>Your thoughts</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="What’s helpful? What’s missing?"
                />
              </label>

              <div className="bld-fb-grid">
                <label className="bld-fb-field">
                  <span>Name (optional)</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <label className="bld-fb-field">
                  <span>Email (optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={160}
                    autoComplete="email"
                    placeholder="For a reply if needed"
                  />
                </label>
              </div>

              <label className="bld-fb-honeypot" aria-hidden>
                Company
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>

              {error ? (
                <p className="bld-fb-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="bld-btn bld-btn--primary bld-fb-submit"
                disabled={busy}
              >
                {busy ? 'Sending…' : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function LandingFeedbackFab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="bld-fb-fab" onClick={onClick}>
      <MessageSquareHeart size={20} strokeWidth={2.1} aria-hidden />
      Feedback
    </button>
  );
}
