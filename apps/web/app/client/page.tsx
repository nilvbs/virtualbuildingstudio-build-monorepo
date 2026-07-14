'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, FolderPlus, MapPin, Plus } from 'lucide-react';
import { SURVEY_SERVICE_LABELS, clientProjectHeadline, type Project } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/status';

function formatPosted(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getProjects()
      .then(setProjects)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  const count = projects?.length ?? 0;

  return (
    <div className="projects-stage">
      {error && <div className="alert error">{error}</div>}

      <section className="projects-panel">
        <div className="projects-panel-head">
          <div>
            <h1 className="projects-panel-title">Your projects</h1>
            <p className="projects-panel-count">
              {loading ? 'Loading…' : count === 0 ? 'No projects yet' : `${count} project${count === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link className="btn" href="/client/projects/new">
            <Plus size={17} /> Post a project
          </Link>
        </div>

        {loading && (
          <div className="project-card-grid">
            {[0, 1, 2].map((i) => (
              <div className="project-card" key={i}>
                <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
                <div className="skeleton sk-line" style={{ width: '50%', marginTop: 18 }} />
                <div className="skeleton sk-line" style={{ width: '78%' }} />
                <div className="skeleton sk-line" style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="empty projects-empty">
            <div className="empty-ico">
              <FolderPlus size={24} />
            </div>
            <h3 style={{ fontSize: 18 }}>Nothing here yet</h3>
            <p style={{ color: 'var(--muted)', margin: '6px 0 0', maxWidth: 360 }}>
              Start with a short brief — title, site, and services — and we&apos;ll take matching from there.
            </p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="project-card-grid stagger">
            {projects.map((p) => {
              const { headline } = clientProjectHeadline(p.status);
              const services = p.services.slice(0, 2).map((s) => SURVEY_SERVICE_LABELS[s]);
              const extra = p.services.length - services.length;
              return (
                <Link key={p.id} href={`/client/projects/${p.id}`} className="project-card plain">
                  <div className="project-card-top">
                    <span className="project-card-ico" aria-hidden>
                      <Building2 size={18} />
                    </span>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="project-card-title">{p.title}</div>
                  <p className="project-card-meta">{headline}</p>

                  {(p.locationText || services.length > 0) && (
                    <div className="project-card-facts">
                      {p.locationText ? (
                        <span className="project-card-fact">
                          <MapPin size={13} aria-hidden />
                          <span>{p.locationText}</span>
                        </span>
                      ) : null}
                      {services.length > 0 ? (
                        <span className="project-card-fact project-card-fact--services">
                          {services.join(' · ')}
                          {extra > 0 ? ` +${extra}` : ''}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="project-card-foot">
                    <span className="project-card-date">{formatPosted(p.createdAt)}</span>
                    <span className="project-card-cta">
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
