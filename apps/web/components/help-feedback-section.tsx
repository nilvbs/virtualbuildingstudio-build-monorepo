'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareHeart, X } from 'lucide-react';
import type { HelpTicketWorkspace } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { FeedbackForm } from './feedback-form';

type PendingFeedback = {
  matchId: string;
  projectTitle: string;
  counterpartLabel: string;
};

export function HelpFeedbackSection({ workspace }: { workspace: HelpTicketWorkspace }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<PendingFeedback[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setError(null);
    if (workspace === 'surveyor') {
      const rows = await api.getSurveyorMatches();
      const next: PendingFeedback[] = rows
        .filter((m) => m.canLeaveFeedback)
        .map((m) => ({
          matchId: m.matchId,
          projectTitle: m.project.title,
          counterpartLabel: m.client.username ? `@${m.client.username}` : 'your client',
        }));
      setPending(next);
      setSelectedMatchId((prev) =>
        prev && next.some((n) => n.matchId === prev) ? prev : (next[0]?.matchId ?? null),
      );
      return;
    }

    const projects = await api.getProjects();
    const candidates = projects.filter((p) =>
      ['completed', 'confirmed', 'matched'].includes(p.status),
    );
    const details = await Promise.all(
      candidates.slice(0, 25).map((p) => api.getProject(p.id).catch(() => null)),
    );
    const next: PendingFeedback[] = [];
    for (const detail of details) {
      if (!detail) continue;
      for (const m of detail.matches) {
        if (!m.canLeaveFeedback) continue;
        next.push({
          matchId: m.matchId,
          projectTitle: detail.title,
          counterpartLabel: m.surveyorUsername ? `@${m.surveyorUsername}` : 'your surveyor',
        });
      }
    }
    setPending(next);
    setSelectedMatchId((prev) =>
      prev && next.some((n) => n.matchId === prev) ? prev : (next[0]?.matchId ?? null),
    );
  }, [workspace]);

  function openDrawer() {
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }

  function closeDrawer() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 280);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, open, reloadKey]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDrawer();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selected = useMemo(
    () => pending.find((p) => p.matchId === selectedMatchId) ?? pending[0] ?? null,
    [pending, selectedMatchId],
  );

  const drawer =
    open && mounted
      ? createPortal(
          <div
            className={`hd-drawer-root${visible ? ' is-open' : ''}`}
            role="presentation"
          >
            <button
              type="button"
              className="hd-drawer-backdrop"
              aria-label="Close feedback"
              onClick={closeDrawer}
            />
            <aside
              className="hd-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Feedback form"
            >
              <header className="hd-drawer-head">
                <div className="hd-drawer-brand">
                  <span className="hd-drawer-ico" aria-hidden>
                    <MessageSquareHeart size={18} />
                  </span>
                  <div>
                    <p className="fb-kicker">Product feedback</p>
                    <h2>How is BLD working?</h2>
                    <p className="hd-drawer-sub">
                      Rate the product and services after a completed job — matching, tools, and
                      support.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="hd-drawer-close"
                  aria-label="Close"
                  onClick={closeDrawer}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="hd-drawer-body">
                {error ? <div className="alert error">{error}</div> : null}
                {loading ? (
                  <div className="hd-drawer-skel">
                    <div className="skeleton" style={{ height: 88, borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
                  </div>
                ) : selected ? (
                  <>
                    {pending.length > 1 ? (
                      <label className="hd-feedback-pick">
                        <span>Job to rate</span>
                        <select
                          value={selected.matchId}
                          onChange={(e) => setSelectedMatchId(e.target.value)}
                        >
                          {pending.map((p) => (
                            <option key={p.matchId} value={p.matchId}>
                              {p.projectTitle}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <FeedbackForm
                      key={`${selected.matchId}-${reloadKey}`}
                      matchId={selected.matchId}
                      counterpartLabel={selected.counterpartLabel}
                      projectTitle={selected.projectTitle}
                      role={workspace}
                      onSubmitted={() => setReloadKey((k) => k + 1)}
                    />
                  </>
                ) : (
                  <FeedbackForm
                    matchId=""
                    counterpartLabel={workspace === 'client' ? 'your surveyor' : 'your client'}
                    projectTitle="your completed job"
                    role={workspace}
                    idleMessage={
                      'After a project match is completed, you can rate BLD’s product and services here.'
                    }
                  />
                )}
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <section className="hd-feedback" aria-label="Feedback and rating">
      <div className="hd-feedback-bar">
        <button type="button" className="btn hd-feedback-outline" onClick={openDrawer}>
          Feedback
        </button>
      </div>
      {drawer}
    </section>
  );
}
