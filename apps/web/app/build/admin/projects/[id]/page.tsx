'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
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
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { StatusBadge } from '../../../../../components/status';
import { LocationMapPreview } from '../../../../../components/location-map-preview';

const OPEN: ProjectStatus[] = ['submitted', 'matching'];

const MATCH_ACTION_LABEL: Record<MatchStatus, string> = {
  proposed: 'Propose',
  accepted: 'Mark accepted',
  declined: 'Decline',
  completed: 'Mark completed',
  cancelled: 'Cancel match',
};

const PROJECT_ACTION_LABEL: Partial<Record<ProjectStatus, string>> = {
  matching: 'Start matching',
  matched: 'Mark matched',
  confirmed: 'Confirm assignment',
  completed: 'Mark project completed',
  cancelled: 'Cancel project',
};

function matchActionClass(status: MatchStatus): string {
  if (status === 'cancelled' || status === 'declined') return 'btn secondary sm danger-outline';
  if (status === 'completed' || status === 'accepted') return 'btn sm';
  return 'btn secondary sm';
}

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
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
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
      setNotice('Surveyor matched. Client and surveyor have been notified.');
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
      setNotice(`Project status updated to ${status}.`);
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
      setNotice(`Match updated to ${status}.`);
      await loadProject();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-match">
        <div className="skeleton sk-line" style={{ width: 200, height: 22 }} />
        <div className="admin-match-panel skeleton" style={{ marginTop: 16, minHeight: 180 }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="admin-match">
        <div className="alert error">{error ?? 'Project not found.'}</div>
        <Link href="/build/admin/projects" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to projects
        </Link>
      </div>
    );
  }

  const isOpen = OPEN.includes(project.status);
  const nextProjectStatuses = PROJECT_STATUS_TRANSITIONS[project.status];

  return (
    <div className="admin-match">
      <Link href="/build/admin/projects" className="admin-match-back plain">
        <ArrowLeft size={15} /> Projects
      </Link>

      <header className="admin-match-hero">
        <div className="admin-match-hero-copy">
          <p className="ops-kicker">Project workspace</p>
          <h1 className="admin-match-title">{project.title}</h1>
          <p className="admin-match-sub">
            {project.locationText || 'No site address'}
            {' · '}
            Posted {new Date(project.createdAt).toLocaleDateString()}
          </p>
          <div className="admin-match-tags">
            {project.services.map((s) => (
              <span key={s} className="admin-svy-tag">
                {SURVEY_SERVICE_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
        <StatusBadge status={project.status} />
      </header>

      {notice && (
        <div className="alert success">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      <div className="admin-match-grid">
        <section className="admin-match-panel">
          <h2 className="admin-match-panel-title">Project summary</h2>
          <dl className="admin-match-dl">
            <div>
              <dt>Client</dt>
              <dd>
                <Link href={`/build/admin/clients/${project.clientId}`} className="plain admin-match-link">
                  <Building2 size={14} aria-hidden />
                  Open client profile
                </Link>
              </dd>
            </div>
            {project.buildingType ? (
              <div>
                <dt>Building</dt>
                <dd>
                  {project.buildingType.replaceAll('_', ' ')}
                  {project.buildingAge ? ` · ${project.buildingAge}` : ''}
                </dd>
              </div>
            ) : null}
            {project.floors != null ? (
              <div>
                <dt>Floors</dt>
                <dd>{project.floors}</dd>
              </div>
            ) : null}
            {project.areaSqft != null ? (
              <div>
                <dt>Area</dt>
                <dd>{project.areaSqft.toLocaleString()} sq ft</dd>
              </div>
            ) : null}
            {project.neededWithin ? (
              <div>
                <dt>Timeline</dt>
                <dd>{project.neededWithin.replaceAll('_', ' ')}</dd>
              </div>
            ) : null}
            {project.notes ? (
              <div>
                <dt>Notes</dt>
                <dd>{project.notes}</dd>
              </div>
            ) : null}
          </dl>

          {project.location ? (
            <div className="admin-match-map">
              <LocationMapPreview
                lat={project.location.lat}
                lng={project.location.lng}
                label={project.locationText}
              />
            </div>
          ) : project.locationText ? (
            <p className="admin-match-muted">
              <MapPin size={14} aria-hidden /> {project.locationText}
            </p>
          ) : null}
        </section>

        <section className="admin-match-panel">
          <h2 className="admin-match-panel-title">Update project status</h2>
          {nextProjectStatuses.length === 0 ? (
            <p className="admin-match-muted">No further status changes are available for this project.</p>
          ) : (
            <>
              <p className="admin-match-help">Move the job forward in the workflow.</p>
              <div className="admin-match-actions">
                {nextProjectStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={s === 'cancelled' ? 'btn secondary sm danger-outline' : 'btn secondary sm'}
                    disabled={busy}
                    onClick={() => advanceProject(s)}
                  >
                    {PROJECT_ACTION_LABEL[s] ?? `Mark as ${s}`}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="admin-match-panel">
        <div className="admin-match-panel-head">
          <h2 className="admin-match-panel-title">
            Assigned matches
            <span className="admin-match-count">{project.matches.length}</span>
          </h2>
        </div>

        {project.matches.length === 0 ? (
          <p className="admin-match-muted">No surveyors have been matched to this project yet.</p>
        ) : (
          <div className="admin-match-list">
            {project.matches.map((m) => {
              const next = MATCH_STATUS_TRANSITIONS[m.status];
              const name = m.surveyorFullName?.trim() || 'Surveyor';
              return (
                <article className="admin-match-card" key={m.matchId}>
                  <div className="admin-match-card-main">
                    <span className="admin-match-card-ico" aria-hidden>
                      <UserCheck size={18} />
                    </span>
                    <div className="admin-match-card-copy">
                      {m.surveyorProfileId ? (
                        <Link
                          href={`/build/admin/surveyors/${m.surveyorProfileId}`}
                          className="admin-match-card-name plain"
                        >
                          {name}
                        </Link>
                      ) : (
                        <div className="admin-match-card-name">{name}</div>
                      )}
                      <div className="admin-match-card-meta">
                        {m.surveyorBaseCity || 'No base city'}
                        {' · '}
                        Matched {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>

                  {next.length > 0 ? (
                    <div className="admin-match-card-actions">
                      <span className="admin-match-card-actions-label">Available actions</span>
                      <div className="admin-match-actions">
                        {next.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={matchActionClass(s)}
                            disabled={busy}
                            onClick={() => advanceMatch(m.matchId, s)}
                          >
                            {MATCH_ACTION_LABEL[s] ?? s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="admin-match-card-done">No further actions for this match.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isOpen ? (
        <section className="admin-match-panel">
          <h2 className="admin-match-panel-title">
            <Search size={16} aria-hidden /> Find a surveyor
          </h2>
          <p className="admin-match-help">Search the network and create a new match for this project.</p>

          <div className="admin-match-find-grid">
            <label className="ops-control">
              <span>Service</span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as SurveyService | '')}
              >
                <option value="">Any service</option>
                {SURVEY_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {SURVEY_SERVICE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="ops-control">
              <span>Radius (km)</span>
              <input
                type="number"
                value={radiusKm}
                min={1}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                disabled={!useNear}
              />
            </label>
          </div>

          <label className={`check ${useNear ? 'selected' : ''}`} style={{ marginTop: 12, width: 'fit-content' }}>
            <input type="checkbox" checked={useNear} onChange={(e) => setUseNear(e.target.checked)} />
            <MapPin size={15} /> Prefer surveyors near the project site
            {!project.location ? (
              <span className="hint" style={{ marginLeft: 4 }}>
                (no coordinates on file)
              </span>
            ) : null}
          </label>

          <label className="ops-control" style={{ marginTop: 12, display: 'grid' }}>
            <span>Match notes (admin only)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this surveyor fits the job…"
              style={{ minHeight: 72, height: 'auto', lineHeight: 1.4, padding: '10px 12px' }}
            />
          </label>

          <button type="button" className="btn" style={{ marginTop: 14 }} onClick={runBrowse} disabled={browsing}>
            {browsing ? <span className="spin" /> : <Search size={16} />}
            {browsing ? 'Searching…' : 'Search surveyors'}
          </button>

          {surveyors && surveyors.length === 0 ? (
            <div className="empty" style={{ marginTop: 16 }}>
              <div className="empty-ico">
                <Search size={22} />
              </div>
              <h3 style={{ fontSize: 16 }}>No surveyors match</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>
                Try widening the radius or clearing the service filter.
              </p>
            </div>
          ) : null}

          {surveyors && surveyors.length > 0 ? (
            <div className="admin-match-list" style={{ marginTop: 16 }}>
              {surveyors.map((s) => (
                <article className="admin-match-card" key={s.profileId}>
                  <div className="admin-match-card-main">
                    <span className="admin-match-card-ico" aria-hidden>
                      <Wrench size={17} />
                    </span>
                    <div className="admin-match-card-copy">
                      <Link
                        href={`/build/admin/surveyors/${s.profileId}`}
                        className="admin-match-card-name plain"
                      >
                        {s.fullName}
                        {!s.isMatchable ? <span className="pill" style={{ marginLeft: 8 }}>Paused</span> : null}
                      </Link>
                      <div className="admin-match-card-meta">
                        {s.baseCity ?? 'No base city'}
                        {s.distanceKm != null ? ` · ${s.distanceKm} km away` : ''}
                        {' · '}
                        {s.services.map((v) => SURVEY_SERVICE_LABELS[v]).join(', ')}
                      </div>
                    </div>
                    <button type="button" className="btn sm" disabled={busy} onClick={() => match(s.profileId)}>
                      {busy ? <span className="spin" /> : <CheckCircle2 size={15} />}
                      Match
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
