'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Search,
  UserCheck,
  Wrench,
} from 'lucide-react';
import {
  MATCH_STATUS_TRANSITIONS,
  PROJECT_STATUS_TRANSITIONS,
  SURVEY_SERVICES,
  SURVEY_SERVICE_LABELS,
  type AdminSurveyor,
  type MatchStatus,
  type ProjectDetail,
  type ProjectStatus,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { StatusBadge } from '../../../../components/status';

const OPEN: ProjectStatus[] = ['submitted', 'matching'];

export default function AdminMatcherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [service, setService] = useState<SurveyService | ''>('');
  const [useNear, setUseNear] = useState(true);
  const [radiusKm, setRadiusKm] = useState(100);
  const [surveyors, setSurveyors] = useState<AdminSurveyor[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const loadProject = useCallback(async () => {
    const detail = await api.getProject(id);
    setProject(detail);
    if (detail.services[0] && service === '') setService(detail.services[0]);
    return detail;
  }, [id, service]);

  useEffect(() => {
    loadProject()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  async function runBrowse() {
    if (!project) return;
    setBrowsing(true);
    setError(null);
    try {
      const near = useNear && project.location ? project.location : null;
      const list = await api.browseAdminSurveyors({
        service: service || undefined,
        nearLat: near?.lat,
        nearLng: near?.lng,
        radiusKm: near ? radiusKm : undefined,
      });
      setSurveyors(list);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBrowsing(false);
    }
  }

  async function match(surveyorId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.createMatch({ projectId: id, surveyorId, notes: notes.trim() || undefined });
      setNotice('Matched. The client and surveyor have been notified.');
      setSurveyors(null);
      setNotes('');
      await loadProject();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function advanceProject(status: ProjectStatus) {
    setBusy(true);
    setError(null);
    try {
      setProject(await api.updateProjectStatus(id, status));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function advanceMatch(matchId: string, status: MatchStatus) {
    setBusy(true);
    setError(null);
    try {
      await api.updateMatch(matchId, { status });
      await loadProject();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="skeleton sk-line" style={{ width: 200, height: 22 }} />
        <div className="card" style={{ marginTop: 20 }}>
          <div className="skeleton sk-line" style={{ width: '60%' }} />
          <div className="skeleton sk-line" style={{ width: '40%' }} />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <div className="alert error">{error ?? 'Project not found.'}</div>
        <Link href="/admin" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to the queue
        </Link>
      </>
    );
  }

  const isOpen = OPEN.includes(project.status);
  const nextProjectStatuses = PROJECT_STATUS_TRANSITIONS[project.status];

  return (
    <>
      <Link
        href="/admin"
        className="plain"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}
      >
        <ArrowLeft size={15} /> Match queue
      </Link>

      <div className="page-head">
        <div>
          <p className="kicker">Match</p>
          <h1 className="page-title">{project.title}</h1>
          <p className="page-sub">
            {project.services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ')}
            {project.locationText ? ` · ${project.locationText}` : ''}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {notice && (
        <div className="alert success">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      {nextProjectStatuses.length > 0 && (
        <section className="card" style={{ marginBottom: 22 }}>
          <div className="section-title">Advance project</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nextProjectStatuses.map((s) => (
              <button key={s} className="btn secondary sm" disabled={busy} onClick={() => advanceProject(s)}>
                Mark as {s} <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </section>
      )}

      {project.matches.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div className="section-title">
            Matches <span className="count">{project.matches.length}</span>
          </div>
          <div className="list">
            {project.matches.map((m) => {
              const next = MATCH_STATUS_TRANSITIONS[m.status];
              return (
                <div className="row-item" key={m.matchId}>
                  <div className="row-lead">
                    <span className="row-ico" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
                      <UserCheck size={18} />
                    </span>
                    <div>
                      <div className="row-title">
                        Surveyor{m.surveyorBaseCity ? ` · ${m.surveyorBaseCity}` : ''}
                      </div>
                      <div className="row-meta">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusBadge status={m.status} />
                    {next.map((s) => (
                      <button
                        key={s}
                        className="btn ghost sm"
                        disabled={busy}
                        onClick={() => advanceMatch(m.matchId, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isOpen && (
        <section className="card">
          <div className="section-title">
            <Search size={16} /> Find a surveyor
          </div>

          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="field" style={{ minWidth: 200, flex: 1 }}>
              <label htmlFor="svc">Service</label>
              <select id="svc" value={service} onChange={(e) => setService(e.target.value as SurveyService | '')}>
                <option value="">Any service</option>
                {SURVEY_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {SURVEY_SERVICE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 130 }}>
              <label htmlFor="rad">Radius (km)</label>
              <input
                id="rad"
                type="number"
                value={radiusKm}
                min={1}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                disabled={!useNear}
              />
            </div>
          </div>

          <label className={`check ${useNear ? 'selected' : ''}`} style={{ marginBottom: 14, width: 'fit-content' }}>
            <input type="checkbox" checked={useNear} onChange={(e) => setUseNear(e.target.checked)} />
            <MapPin size={15} /> Near the project location
            {!project.location && <span className="hint" style={{ marginLeft: 4 }}>(no coordinates on file)</span>}
          </label>

          <div className="field">
            <label htmlFor="notes">Match notes (admin-only)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for this match — why this surveyor?"
              style={{ minHeight: 72 }}
            />
          </div>

          <button className="btn" onClick={runBrowse} disabled={browsing}>
            {browsing ? <span className="spin" /> : <Search size={16} />}
            {browsing ? 'Searching…' : 'Search surveyors'}
          </button>

          {surveyors && surveyors.length === 0 && (
            <div className="empty" style={{ marginTop: 18 }}>
              <div className="empty-ico">
                <Search size={22} />
              </div>
              <h3 style={{ fontSize: 16 }}>No surveyors match</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Try widening the radius or clearing the service filter.</p>
            </div>
          )}

          {surveyors && surveyors.length > 0 && (
            <div className="list stagger" style={{ marginTop: 18 }}>
              {surveyors.map((s) => (
                <div className="row-item" key={s.profileId}>
                  <div className="row-lead">
                    <span className="row-ico">
                      <Wrench size={17} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row-title">
                        {s.fullName}
                        {!s.isMatchable && (
                          <span className="pill" style={{ marginLeft: 8, fontSize: 11 }}>paused</span>
                        )}
                      </div>
                      <div className="row-meta">
                        {s.baseCity ?? 'No base city'}
                        {s.distanceKm != null ? ` · ${s.distanceKm} km away` : ''} ·{' '}
                        {s.services.map((v) => SURVEY_SERVICE_LABELS[v]).join(', ')}
                      </div>
                    </div>
                  </div>
                  <button className="btn sm" disabled={busy} onClick={() => match(s.profileId)}>
                    {busy ? <span className="spin" /> : <CheckCircle2 size={15} />}
                    Match
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
