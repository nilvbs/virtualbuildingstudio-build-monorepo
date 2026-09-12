'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Briefcase, Mail, MapPin, Phone, Search, ShieldAlert, Users } from 'lucide-react';
import type { AdminClient } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { StatusBadge } from '../../../../components/status';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function LoadingState() {
  return (
    <div className="admin-cli-list">
      {[0, 1, 2].map((i) => (
        <div className="admin-cli-row" key={i} aria-hidden>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <div className="skeleton sk-line" style={{ width: '30%', height: 16 }} />
            <div className="skeleton sk-line" style={{ width: '55%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<AdminClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    api
      .listAdminClients()
      .then(setClients)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) =>
      [c.fullName, c.email, c.phone, c.companyName ?? '', c.city ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [clients, q]);

  return (
    <div className="admin-cli">
      {!forbidden && (
        <div className="admin-cli-bar">
          <div className="admin-cli-summary">
            <h2 className="admin-cli-heading">
              {loading && !clients
                ? 'Loading clients…'
                : `${filtered.length} client${filtered.length === 1 ? '' : 's'}`}
            </h2>
            <p className="admin-cli-lede">Limited card view — open a client for the full dossier.</p>
          </div>
          <div className="admin-cli-filters">
            <label className="admin-cli-search">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input
                type="search"
                placeholder="Search clients"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search clients"
              />
            </label>
            {q.trim() ? (
              <button type="button" className="btn secondary admin-cli-clear" onClick={() => setQ('')}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      )}

      {forbidden && (
        <div className="empty">
          <div className="empty-ico">
            <ShieldAlert size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>No access to clients</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Ask your super admin to grant the “View clients” permission.
          </p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      {loading && !forbidden && <LoadingState />}

      {clients && !forbidden && (
        <>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">
                <Users size={24} />
              </div>
              <h3 style={{ fontSize: 17 }}>{q ? 'No matches' : 'No clients yet'}</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>
                {q ? 'Try a different name, email, or company.' : 'Clients appear here as soon as they sign up.'}
              </p>
              {q ? (
                <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => setQ('')}>
                  Clear search
                </button>
              ) : null}
            </div>
          ) : (
            <div className="admin-cli-list stagger">
              {filtered.map((c) => (
                <article className="admin-cli-row" key={c.id}>
                  <Link href={`/build/admin/clients/${c.id}`} className="admin-cli-avatar plain" aria-label={`Open ${c.fullName}`}>
                    {initials(c.fullName)}
                  </Link>
                  <div className="admin-cli-main">
                    <div className="admin-cli-title-row">
                      <Link href={`/build/admin/clients/${c.id}`} className="admin-cli-name plain">
                        {c.fullName}
                      </Link>
                      <Link
                        href={`/build/admin/projects?clientId=${c.id}`}
                        className="admin-cli-projects-pill plain"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Briefcase size={13} aria-hidden />
                        {c.projectCount} {c.projectCount === 1 ? 'project' : 'projects'}
                      </Link>
                    </div>

                    <div className="admin-cli-meta">
                      {c.companyName ? (
                        <span>
                          <Building2 size={13} aria-hidden />
                          {c.companyName}
                        </span>
                      ) : null}
                      <span>
                        <Mail size={13} aria-hidden />
                        {c.email}
                      </span>
                      <span>
                        <Phone size={13} aria-hidden />
                        {c.phone}
                      </span>
                      {c.city ? (
                        <span>
                          <MapPin size={13} aria-hidden />
                          {c.city}
                        </span>
                      ) : null}
                    </div>

                    {c.recentProjects.length > 0 ? (
                      <ul className="admin-cli-projects">
                        {c.recentProjects.map((p) => (
                          <li key={p.id}>
                            <Link href={`/build/admin/projects/${p.id}`} className="admin-cli-project-link plain">
                              <span className="admin-cli-project-title">{p.title}</span>
                              <StatusBadge status={p.status} />
                            </Link>
                            {p.assignedSurveyor ? (
                              <Link
                                href={`/build/admin/surveyors/${p.assignedSurveyor.profileId}`}
                                className="admin-cli-surveyor plain"
                              >
                                Surveyor: {p.assignedSurveyor.fullName}
                              </Link>
                            ) : (
                              <span className="admin-cli-surveyor is-muted">No surveyor assigned</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="admin-cli-empty-projects">No projects posted yet.</p>
                    )}

                    <div className="admin-cli-actions">
                      <Link href={`/build/admin/clients/${c.id}`} className="btn secondary sm">
                        View profile
                      </Link>
                      {c.projectCount > 0 ? (
                        <Link href={`/build/admin/projects?clientId=${c.id}`} className="btn sm">
                          All projects
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
