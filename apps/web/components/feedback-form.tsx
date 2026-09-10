'use client';

import { useState } from 'react';
import { Check, Star } from 'lucide-react';
import {
  FEEDBACK_ASPECT_KEYS,
  FEEDBACK_ASPECT_LABELS,
  FEEDBACK_RATING_EMOJIS,
  type FeedbackAspectKey,
  type FeedbackAspects,
} from '@surveylink/types';
import { api, errorMessage } from '../lib/api';

type Props = {
  matchId: string;
  /** Who they're rating — display only. */
  counterpartLabel: string;
  projectTitle: string;
  role: 'client' | 'surveyor';
  onSubmitted?: () => void;
  /** When set, form is visible but not submittable (no pending job). */
  idleMessage?: string;
};

export function FeedbackForm({
  matchId,
  counterpartLabel,
  projectTitle,
  role,
  onSubmitted,
  idleMessage,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [aspects, setAspects] = useState<FeedbackAspects>({});
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const idle = Boolean(idleMessage);
  const counterpart =
    role === 'client' ? `surveyor ${counterpartLabel}` : `client ${counterpartLabel}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (idle) return;
    setError(null);
    if (rating < 1) {
      setError('Please choose an overall rating (emoji or stars).');
      return;
    }
    if (comment.trim().length < 10) {
      setError('Please add a short note (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      await api.submitFeedback({
        matchId,
        rating,
        comment: comment.trim(),
        aspects,
        recommend,
      });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function setAspect(key: FeedbackAspectKey, value: number) {
    if (idle) return;
    setAspects((prev) => ({ ...prev, [key]: value }));
  }

  if (done) {
    return (
      <div className="fb-card fb-card--done">
        <div className="fb-done-ico" aria-hidden>
          <Check size={22} strokeWidth={2.5} />
        </div>
        <h3>Thank you</h3>
        <p>
          Your rating for <strong>{projectTitle}</strong> was sent. We emailed you a confirmation,
          and our team can see it in admin.
        </p>
      </div>
    );
  }

  const activeHint = hover || rating;

  return (
    <form className={`fb-card${idle ? ' fb-card--idle' : ''}`} onSubmit={submit} noValidate>
      <header className="fb-head">
        <p className="fb-kicker">Feedback &amp; rating</p>
        <h3>How was working with {counterpart}?</h3>
        <p className="fb-sub">
          {idle
            ? idleMessage
            : 'Honest ratings keep BLD trustworthy for the next job. Takes under a minute.'}
        </p>
      </header>

      <fieldset className="fb-stars" disabled={idle}>
        <legend>Overall experience *</legend>
        <div className="fb-emoji-row" role="radiogroup" aria-label="Overall rating with emoji">
          {([1, 2, 3, 4, 5] as const).map((n) => {
            const meta = FEEDBACK_RATING_EMOJIS[n];
            const on = rating === n;
            const soft = activeHint === n;
            return (
              <button
                key={n}
                type="button"
                className={`fb-emoji${on ? ' is-on' : ''}${soft && !on ? ' is-soft' : ''}`}
                aria-label={`${n} — ${meta.label}`}
                aria-checked={rating === n}
                role="radio"
                disabled={idle}
                onMouseEnter={() => !idle && setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => !idle && setRating(n)}
              >
                <span className="fb-emoji-face" aria-hidden>
                  {meta.emoji}
                </span>
                <span className="fb-emoji-label">{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="fb-stars-row" role="radiogroup" aria-label="Overall star rating">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                className={`fb-star ${on ? 'is-on' : ''}`}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                aria-checked={rating === n}
                role="radio"
                disabled={idle}
                onMouseEnter={() => !idle && setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => !idle && setRating(n)}
              >
                <Star size={22} fill={on ? 'currentColor' : 'none'} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
        <p className="fb-stars-hint">
          {idle
            ? 'Form unlocks when a completed job is ready to rate'
            : rating === 0
              ? 'Tap an emoji or stars to rate'
              : rating <= 2
                ? 'Sorry it fell short — tell us what happened'
                : rating === 3
                  ? 'Okay — room to improve'
                  : rating === 4
                    ? 'Great — almost perfect'
                    : 'Excellent — would hire again'}
        </p>
      </fieldset>

      <div className="fb-aspects">
        <p className="fb-aspects-label">Rate a few specifics (optional)</p>
        <ul>
          {FEEDBACK_ASPECT_KEYS.map((key) => (
            <li key={key}>
              <span>{FEEDBACK_ASPECT_LABELS[key]}</span>
              <div className="fb-aspect-stars" role="group" aria-label={FEEDBACK_ASPECT_LABELS[key]}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = (aspects[key] ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`fb-star fb-star--sm ${on ? 'is-on' : ''}`}
                      aria-label={`${n}`}
                      disabled={idle}
                      onClick={() => setAspect(key, n)}
                    >
                      <Star size={16} fill={on ? 'currentColor' : 'none'} strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="fb-recommend" disabled={idle}>
        <legend>Would you work together again?</legend>
        <div className="fb-recommend-row">
          <button
            type="button"
            className={`fb-chip ${recommend === true ? 'is-on' : ''}`}
            disabled={idle}
            onClick={() => setRecommend(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`fb-chip ${recommend === false ? 'is-on' : ''}`}
            disabled={idle}
            onClick={() => setRecommend(false)}
          >
            No
          </button>
        </div>
      </fieldset>

      <label className="fb-comment">
        <span>What stood out? *</span>
        <textarea
          rows={4}
          maxLength={2000}
          placeholder={
            role === 'client'
              ? 'Accuracy, communication, site professionalism…'
              : 'Clear brief, site access, timely decisions…'
          }
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required={!idle}
          disabled={idle}
        />
        {!idle ? <em>{comment.trim().length}/10 minimum</em> : null}
      </label>

      {error && <div className="alert error">{error}</div>}

      <button type="submit" className="btn primary fb-submit" disabled={busy || idle}>
        {idle ? 'Waiting for a completed job' : busy ? 'Sending…' : 'Submit feedback'}
      </button>
    </form>
  );
}
