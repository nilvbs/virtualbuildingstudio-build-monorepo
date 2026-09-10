'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HelpTicketWorkspace } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { FeedbackForm } from './feedback-form';

type PendingFeedback = {
  matchId: string;
  projectTitle: string;
  counterpartLabel: string;
};

export function HelpFeedbackSection({ workspace }: { workspace: HelpTicketWorkspace }) {
  const [pending, setPending] = useState<PendingFeedback[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  useEffect(() => {
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
  }, [load, reloadKey]);

  const selected = useMemo(
    () => pending.find((p) => p.matchId === selectedMatchId) ?? pending[0] ?? null,
    [pending, selectedMatchId],
  );

  return (
    <section className="hd-feedback" aria-label="Feedback and rating">
      {error ? <div className="alert error">{error}</div> : null}

      {loading ? (
        <div className="skeleton" style={{ minHeight: 220, borderRadius: 16 }} />
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
                    {p.projectTitle} · {p.counterpartLabel}
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
            workspace === 'client'
              ? 'After a project match is completed, you can rate the surveyor here — emoji or stars, same short form.'
              : 'After you complete a matched job, you can rate the client here — emoji or stars, same short form.'
          }
        />
      )}
    </section>
  );
}
