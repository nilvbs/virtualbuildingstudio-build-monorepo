'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  HardHat,
  MessageSquareQuote,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  FEEDBACK_ASPECT_KEYS,
  FEEDBACK_ASPECT_LABELS,
  FEEDBACK_RATING_EMOJIS,
  feedbackRatingEmoji,
  type Feedback,
  type SiteFeedback,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';

function personLabel(fullName: string | null, username: string | null) {
  return fullName?.trim() || username || 'Unknown';
}

function commentPreview(text: string, max = 110) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function AspectBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <li className="admin-fb-aspect">
      <div className="admin-fb-aspect-top">
        <span>{label}</span>
        <strong>{value}/5</strong>
      </div>
      <span className="admin-fb-aspect-track" aria-hidden>
        <span className="admin-fb-aspect-fill" style={{ width: `${pct}%` }} />
      </span>
    </li>
  );
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Feedback[] | null>(null);
  const [siteRows, setSiteRows] = useState<SiteFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    Promise.all([api.listAdminFeedback(), api.listAdminSiteFeedback()])
      .then(([jobRows, landingRows]) => {
        setRows(jobRows);
        setSiteRows(landingRows);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  const selected = useMemo(
    () => rows?.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDetail();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [selectedId]);

  function openDetail(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeDetail() {
    setDrawerVisible(false);
    window.setTimeout(() => setSelectedId(null), 280);
  }

  const stats = useMemo(() => {
    if (!rows?.length) {
      return {
        avg: null as number | null,
        excellent: 0,
        recommendYes: 0,
        recommendTotal: 0,
        fromClients: 0,
        fromSurveyors: 0,
      };
    }
    const avg = Math.round((rows.reduce((s, f) => s + f.rating, 0) / rows.length) * 10) / 10;
    const excellent = rows.filter((f) => f.rating >= 5).length;
    const recommendable = rows.filter((f) => f.recommend != null);
    const recommendYes = recommendable.filter((f) => f.recommend).length;
    return {
      avg,
      excellent,
      recommendYes,
      recommendTotal: recommendable.length,
      fromClients: rows.filter((f) => f.fromRole === 'client').length,
      fromSurveyors: rows.filter((f) => f.fromRole === 'surveyor').length,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="admin-fb">
        <div className="admin-fb-metrics">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ minHeight: 72, borderRadius: 12 }} />
          ))}
        </div>
        <div className="skeleton" style={{ minHeight: 140, borderRadius: 14 }} />
      </div>
    );
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!rows) return null;

  const avgMeta =
    stats.avg != null
      ? FEEDBACK_RATING_EMOJIS[Math.max(1, Math.min(5, Math.round(stats.avg))) as 1 | 2 | 3 | 4 | 5]
      : null;
  const recommendPct = stats.recommendTotal
    ? Math.round((stats.recommendYes / stats.recommendTotal) * 100)
    : null;

  const detailDrawer =
    selected && mounted
      ? createPortal(
          <div
            className={`hd-drawer-root${drawerVisible ? ' is-open' : ''}`}
            role="presentation"
          >
            <button
              type="button"
              className="hd-drawer-backdrop"
              aria-label="Close feedback detail"
              onClick={closeDetail}
            />
            <aside
              className="hd-drawer-panel admin-fb-detail-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Feedback detail"
            >
              <header className="hd-drawer-head">
                <div className="hd-drawer-brand">
                  <span className="hd-drawer-ico" aria-hidden>
                    <MessageSquareQuote size={18} />
                  </span>
                  <div>
                    <p className="fb-kicker">Product feedback</p>
                    <h2>{selected.projectTitle}</h2>
                    <p className="hd-drawer-sub">
                      {selected.fromRole === 'client' ? 'Client' : 'Surveyor'} review of BLD
                      product &amp; services
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="hd-drawer-close"
                  aria-label="Close"
                  onClick={closeDetail}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="hd-drawer-body admin-fb-detail-body">
                <div
                  className={`admin-fb-detail-score admin-fb-tone--${Math.max(1, Math.min(5, selected.rating))}`}
                >
                  <span aria-hidden>{feedbackRatingEmoji(selected.rating)}</span>
                  <div>
                    <strong>
                      {selected.rating}
                      <em>/5</em>
                    </strong>
                    <p>
                      {
                        FEEDBACK_RATING_EMOJIS[
                          Math.max(1, Math.min(5, selected.rating)) as 1 | 2 | 3 | 4 | 5
                        ].label
                      }
                    </p>
                  </div>
                </div>

                <dl className="admin-fb-detail-meta">
                  <div>
                    <dt>Submitted by</dt>
                    <dd>
                      {personLabel(selected.fromFullName, selected.fromUsername)}
                      <span>
                        {selected.fromRole === 'client' ? 'Client' : 'Surveyor'}
                        {selected.fromUsername ? ` · @${selected.fromUsername}` : ''}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Project</dt>
                    <dd>
                      <Link href={`/build/admin/projects/${selected.projectId}`}>
                        {selected.projectTitle}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      <time dateTime={selected.createdAt}>
                        {new Date(selected.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </time>
                    </dd>
                  </div>
                </dl>

                <blockquote className="admin-fb-comment">
                  <p>{selected.comment}</p>
                </blockquote>

                {FEEDBACK_ASPECT_KEYS.some((k) => selected.aspects[k]) ? (
                  <ul className="admin-fb-aspects">
                    {FEEDBACK_ASPECT_KEYS.filter((k) => selected.aspects[k]).map((k) => (
                      <AspectBar
                        key={k}
                        label={FEEDBACK_ASPECT_LABELS[k]}
                        value={selected.aspects[k] as number}
                      />
                    ))}
                  </ul>
                ) : null}

                <footer className="admin-fb-foot">
                  <span className="admin-fb-stars" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={13}
                        fill={i < selected.rating ? 'currentColor' : 'none'}
                        strokeWidth={i < selected.rating ? 0 : 1.75}
                      />
                    ))}
                  </span>
                  {selected.recommend == null ? (
                    <span className="admin-fb-chip admin-fb-chip--muted">No recommend answer</span>
                  ) : selected.recommend ? (
                    <span className="admin-fb-chip admin-fb-chip--yes">
                      <ThumbsUp size={13} />
                      Would recommend BLD
                    </span>
                  ) : (
                    <span className="admin-fb-chip admin-fb-chip--no">
                      <ThumbsDown size={13} />
                      Would not recommend BLD
                    </span>
                  )}
                </footer>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="admin-fb">
      <div className="admin-fb-top">
        <p className="admin-fb-lead">
          Product and service ratings after completed jobs.
        </p>
        <div
          className="admin-fb-avg"
          aria-label={stats.avg != null ? `Average ${stats.avg} of 5` : 'No ratings yet'}
        >
          <span className="admin-fb-avg-emoji" aria-hidden>
            {stats.avg != null ? feedbackRatingEmoji(Math.round(stats.avg)) : '✦'}
          </span>
          <div className="admin-fb-avg-copy">
            <strong>{stats.avg != null ? stats.avg.toFixed(1) : '—'}</strong>
            <span>{avgMeta ? `${avgMeta.label} avg` : 'No ratings yet'}</span>
          </div>
        </div>
      </div>

      <section className="admin-fb-metrics" aria-label="Feedback summary">
        <article className="admin-fb-metric">
          <span className="admin-fb-metric-ico" aria-hidden>
            <MessageSquareQuote size={16} />
          </span>
          <div className="admin-fb-metric-body">
            <strong className="admin-fb-metric-value">{rows.length}</strong>
            <span className="admin-fb-metric-label">Total reviews</span>
          </div>
        </article>
        <article className="admin-fb-metric">
          <span className="admin-fb-metric-ico admin-fb-metric-ico--amber" aria-hidden>
            <Sparkles size={16} />
          </span>
          <div className="admin-fb-metric-body">
            <strong className="admin-fb-metric-value">{stats.excellent}</strong>
            <span className="admin-fb-metric-label">Excellent (5★)</span>
          </div>
        </article>
        <article className="admin-fb-metric">
          <span className="admin-fb-metric-ico admin-fb-metric-ico--green" aria-hidden>
            <ThumbsUp size={16} />
          </span>
          <div className="admin-fb-metric-body">
            <strong className="admin-fb-metric-value">
              {recommendPct != null ? `${recommendPct}%` : '0%'}
            </strong>
            <span className="admin-fb-metric-label">Recommend BLD</span>
          </div>
        </article>
        <article className="admin-fb-metric">
          <span className="admin-fb-metric-ico admin-fb-metric-ico--teal" aria-hidden>
            <Users size={16} />
          </span>
          <div className="admin-fb-metric-body admin-fb-metric-body--pair">
            <div className="admin-fb-metric-pair">
              <UserRound size={12} aria-hidden />
              <strong>{stats.fromClients}</strong>
              <span>Client</span>
            </div>
            <div className="admin-fb-metric-pair">
              <HardHat size={12} aria-hidden />
              <strong>{stats.fromSurveyors}</strong>
              <span>Surveyor</span>
            </div>
          </div>
        </article>
      </section>

      {rows.length === 0 ? (
        <div className="admin-fb-empty">
          <div className="admin-fb-empty-ico" aria-hidden>
            <MessageSquareQuote size={20} />
          </div>
          <h2>No product feedback yet</h2>
          <p>
            After a match completes, clients and surveyors can rate BLD’s product and services.
          </p>
        </div>
      ) : (
        <ul className="admin-fb-grid">
          {rows.map((f, index) => {
            const ratingMeta =
              FEEDBACK_RATING_EMOJIS[Math.max(1, Math.min(5, f.rating)) as 1 | 2 | 3 | 4 | 5];
            const fromName = personLabel(f.fromFullName, f.fromUsername);
            const tone = Math.max(1, Math.min(5, f.rating));

            return (
              <li
                key={f.id}
                className={`admin-fb-tile admin-fb-tone--${tone}`}
                style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
              >
                <div className="admin-fb-tile-top">
                  <span className={`admin-fb-badge admin-fb-badge--${f.fromRole}`}>
                    {f.fromRole === 'client' ? 'Client' : 'Surveyor'}
                  </span>
                  <span className="admin-fb-tile-score" aria-label={`${f.rating} of 5`}>
                    <span aria-hidden>{feedbackRatingEmoji(f.rating)}</span>
                    <strong>{f.rating}/5</strong>
                    <em>{ratingMeta.label}</em>
                  </span>
                </div>

                <h2 className="admin-fb-tile-title">{f.projectTitle}</h2>
                <p className="admin-fb-tile-by">
                  {fromName}
                  {f.fromUsername ? ` · @${f.fromUsername}` : ''}
                </p>
                <p className="admin-fb-tile-preview">{commentPreview(f.comment)}</p>

                <div className="admin-fb-tile-foot">
                  <time dateTime={f.createdAt}>
                    {new Date(f.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                  <button
                    type="button"
                    className="btn secondary sm admin-fb-view"
                    onClick={() => openDetail(f.id)}
                  >
                    <Eye size={14} />
                    View
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="admin-fb-site" aria-label="Landing page feedback">
        <div className="admin-fb-site-head">
          <h2>Landing &amp; support</h2>
          <p>Public notes from the marketing site.</p>
        </div>
        {siteRows.length === 0 ? (
          <p className="admin-fb-site-empty">No landing feedback yet.</p>
        ) : (
          <ul className="admin-fb-site-list">
            {siteRows.map((f) => {
              const ratingMeta =
                FEEDBACK_RATING_EMOJIS[Math.max(1, Math.min(5, f.rating)) as 1 | 2 | 3 | 4 | 5];
              return (
                <li key={f.id} className="admin-fb-site-item">
                  <div className="admin-fb-site-item-top">
                    <span aria-hidden>{feedbackRatingEmoji(f.rating)}</span>
                    <strong>
                      {f.rating}/5 · {ratingMeta.label}
                    </strong>
                    <em>{f.source}</em>
                  </div>
                  <p>{f.message}</p>
                  <div className="admin-fb-site-item-foot">
                    <span>
                      {f.name?.trim() || 'Anonymous'}
                      {f.email ? ` · ${f.email}` : ''}
                    </span>
                    <time dateTime={f.createdAt}>
                      {new Date(f.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detailDrawer}
    </div>
  );
}
