'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, FolderPlus, MapPin, Plus, Sparkles } from 'lucide-react';
import { SURVEY_SERVICE_LABELS, clientProjectHeadline, type Project, type ProjectStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/status';

function formatPosted(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function countByBucket(projects: Project[]) {
  const open: ProjectStatus[] = ['submitted', 'matching', 'matched', 'confirmed'];
  return {
    total: projects.length,
    active: projects.filter((p) => open.includes(p.status)).length,
    completed: projects.filter((p) => p.status === 'completed').length,
  };
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, me] = await Promise.all([api.getProjects(), api.me()]);
        if (cancelled) return;
        setProjects(rows);
        setUserName(me.firstName || me.fullName.split(/\s+/)[0] || 'there');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const stats = useMemo(() => countByBucket(projects ?? []), [projects]);

  return (
    <div className="cli-home">
      {error && <div className="alert error">{error}</div>}

      <header className="cli-home-hero">
        <div className="cli-home-hero-copy">
          <p className="ops-kicker">Client workspace</p>
          <h1 className="cli-home-title">
            {loading ? 'Your projects' : `Hi ${userName}`}
          </h1>
          <p className="cli-home-sub">
            Post a brief and we&apos;ll notify nearby surveyors automatically.
          </p>
        </div>
        <Link className="btn" href="/client/projects/new">
          <Plus size={17} /> Post a project
        </Link>
      </header>

      <div className="cli-home-stats">
        <div className="cli-home-stat">
          <span className="cli-home-stat-label">All projects</span>
          <strong>{loading ? '—' : stats.total}</strong>
        </div>
        <div className="cli-home-stat">
          <span className="cli-home-stat-label">In progress</span>
          <strong>{loading ? '—' : stats.active}</strong>
        </div>
        <div className="cli-home-stat">
          <span className="cli-home-stat-label">Completed</span>
          <strong>{loading ? '—' : stats.completed}</strong>
        </div>
      </div>

      <section className="cli-home-panel">
        <div className="cli-home-panel-head">
          <h2 className="cli-home-panel-title">
            Your projects
            {!loading ? <span className="cli-home-count">{stats.total}</span> : null}
          </h2>
        </div>

        {loading && (
          <div className="cli-project-grid">
            {[0, 1, 2].map((i) => (
              <div className="cli-project-card" key={i}>
                <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
                <div className="skeleton sk-line" style={{ width: '50%', marginTop: 18 }} />
                <div className="skeleton sk-line" style={{ width: '78%' }} />
                <div className="skeleton sk-line" style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="cli-home-empty">
            <div className="cli-home-empty-ico" aria-hidden>
              <FolderPlus size={22} />
            </div>
            <h3>Nothing here yet</h3>
            <p>
              Start with a short brief — title, site, and services — and nearby surveyors get notified
              with a working-hours response window.
            </p>
            <Link className="btn" href="/client/projects/new">
              <Plus size={16} /> Post your first project
            </Link>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="cli-project-grid stagger">
            {projects.map((p) => {
              const { headline } = clientProjectHeadline(p.status);
              const services = p.services.slice(0, 2).map((s) => SURVEY_SERVICE_LABELS[s]);
              const extra = p.services.length - services.length;
              const matching = p.status === 'matching' || p.status === 'submitted';
              return (
                <Link
                  key={p.id}
                  href={`/client/projects/${p.id}`}
                  className={`cli-project-card plain${matching ? ' is-live' : ''}`}
                >
                  <div className="cli-project-card-top">
                    <span className="cli-project-card-ico" aria-hidden>
                      {matching ? <Sparkles size={17} /> : <Building2 size={17} />}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="cli-project-card-title">{p.title}</div>
                  <p className="cli-project-card-meta">{headline}</p>

                  {(p.locationText || services.length > 0) && (
                    <div className="cli-project-card-facts">
                      {p.locationText ? (
                        <span className="cli-project-card-fact">
                          <MapPin size={13} aria-hidden />
                          <span>{p.locationText}</span>
                        </span>
                      ) : null}
                      {services.length > 0 ? (
                        <span className="cli-project-card-fact">
                          {services.join(' · ')}
                          {extra > 0 ? ` +${extra}` : ''}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="cli-project-card-foot">
                    <span>{formatPosted(p.createdAt)}</span>
                    <span className="cli-project-card-cta">
                      Open <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
