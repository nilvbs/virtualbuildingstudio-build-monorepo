'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, Inbox, MapPin, Search, ShieldAlert, UserCheck, X } from 'lucide-react';
import { SURVEY_SERVICE_LABELS, type AdminQueueProject } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { StatusBadge } from '../../../../components/status';

function LoadingState() {
  return (
    <div className="entity-card-grid">
      {[0, 1, 2, 3].map((i) => (
        <div className="entity-card" key={i}>
          <div className="skeleton sk-line" style={{ width: '55%', height: 18 }} />
          <div className="skeleton sk-line" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

export default function AdminProjectsPageInner({
  scope = 'pipeline',
}: {
  scope?: 'pipeline' | 'all';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId')?.trim() || '';
  const listScope = clientId ? 'all' : scope;

  const [projects, setProjects] = useState<AdminQueueProject[] | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .listAdminOpenProjects(clientId ? { clientId, scope: 'all' } : { scope: listScope })
      .then((rows) => {
        setProjects(rows);
        setClientName(clientId && rows[0] ? rows[0].clientName : clientId ? 'Selected client' : null);
        setForbidden(false);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router, clientId, listScope]);

  useEffect(() => {
    if (!clientId) return;
    api
      .getAdminClient(clientId)
      .then((c) => setClientName(c.fullName))
      .catch(() => undefined);
  }, [clientId]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const term = q.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) =>
      [p.title, p.clientName, p.locationText ?? '', p.assignedSurveyor?.fullName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [projects, q]);

  const heading =
    loading && !projects
      ? 'Loading projects…'
      : clientId
        ? `Projects by ${clientName ?? 'client'}`
        : scope === 'all'
          ? 'All projects'
          : 'Match pipeline';

  const lede = clientId
    ? 'All projects posted by this client, including assigned surveyors.'
    : scope === 'all'
      ? 'Every project on BLD — from matching through completed.'
      : 'Projects pending a surveyor match. Keep these moving.';

  const emptyTitle = q || clientId ? 'No matches' : scope === 'all' ? 'No projects yet' : 'Pipeline is clear';
  const emptyBody = q
    ? 'Try a different title, client, location, or surveyor.'
    : clientId
      ? 'This client has no projects yet.'
      : scope === 'all'
        ? 'Projects will appear here when clients publish a brief.'
        : 'New posts that still need a match will show here.';

  const homeHref = scope === 'all' ? '/build/admin/projects' : '/build/admin/pipeline';

  return (
    <div className="admin-proj">
      {!forbidden && (
        <div className="admin-proj-bar">
          <div>
            <h2 className="admin-proj-heading">{heading}</h2>
            <p className="admin-proj-lede">{lede}</p>
          </div>
          <div className="admin-proj-filters">
            {clientId ? (
              <Link href={homeHref} className="btn secondary admin-proj-clear">
                <X size={14} /> Clear client filter
              </Link>
            ) : null}
            <label className="admin-proj-search">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input
                type="search"
                placeholder="Search projects"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search projects"
              />
            </label>
          </div>
        </div>
      )}

      {forbidden && (
        <div className="empty">
          <div className="empty-ico">
            <ShieldAlert size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>No access to projects</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Ask your super admin to grant the “View projects queue” permission.
          </p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      {loading && !forbidden && <LoadingState />}

      {projects && !forbidden && (
        <>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">
                <Inbox size={24} />
              </div>
              <h3 style={{ fontSize: 17 }}>{emptyTitle}</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>{emptyBody}</p>
              {clientId ? (
                <Link href={homeHref} className="btn" style={{ marginTop: 14 }}>
                  {scope === 'all' ? 'Show all projects' : 'Show pipeline'}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="entity-card-grid stagger">
              {filtered.map((p) => {
                const services = p.services.slice(0, 2).map((s) => SURVEY_SERVICE_LABELS[s]);
                const extra = p.services.length - services.length;
                return (
                  <article key={p.id} className="entity-card admin-proj-card">
                    <div className="entity-card-top">
                      <span className="entity-card-ico" aria-hidden>
                        <Building2 size={18} />
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                    <Link href={`/build/admin/projects/${p.id}`} className="entity-card-title plain">
                      {p.title}
                    </Link>
                    <div className="entity-card-meta">
                      <span className="entity-card-meta-row">
                        <Link href={`/build/admin/clients/${p.clientId}`} className="plain">
                          {p.clientName}
                        </Link>
                      </span>
                      {p.locationText ? (
                        <span className="entity-card-meta-row">
                          <MapPin size={13} aria-hidden />
                          <span>{p.locationText}</span>
                        </span>
                      ) : null}
                      {services.length > 0 ? (
                        <span className="entity-card-meta-row">
                          <span>
                            {services.join(' · ')}
                            {extra > 0 ? ` +${extra}` : ''}
                          </span>
                        </span>
                      ) : null}
                      <span className="entity-card-meta-row">
                        <UserCheck size={13} aria-hidden />
                        {p.assignedSurveyor ? (
                          <Link
                            href={`/build/admin/surveyors/${p.assignedSurveyor.profileId}`}
                            className="plain"
                          >
                            {p.assignedSurveyor.fullName}
                          </Link>
                        ) : (
                          <span>No surveyor assigned</span>
                        )}
                      </span>
                    </div>
                    <div className="entity-card-foot">
                      <span />
                      <Link href={`/build/admin/projects/${p.id}`} className="entity-card-cta plain">
                        Open <ArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
