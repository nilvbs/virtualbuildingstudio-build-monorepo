'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, Inbox, ShieldAlert, Users, UserCheck } from 'lucide-react';
import { SURVEY_SERVICE_LABELS, type AdminQueues } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/status';

function StatCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone?: string;
  value: number;
  label: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className={`stat-icon ${tone ?? ''}`}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <div className="stat-grid">
        {[0, 1, 2].map((i) => (
          <div className="stat" key={i}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 11 }} />
            <div className="skeleton sk-line" style={{ width: '40%', height: 28, marginTop: 16 }} />
            <div className="skeleton sk-line" style={{ width: '60%' }} />
          </div>
        ))}
      </div>
      <div className="list" style={{ marginTop: 32 }}>
        {[0, 1, 2].map((i) => (
          <div className="row-item" key={i}>
            <div className="row-lead" style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton sk-line" style={{ width: '50%' }} />
                <div className="skeleton sk-line" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [queues, setQueues] = useState<AdminQueues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminQueues()
      .then(setQueues)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Operations</p>
          <h1 className="page-title">Match queue</h1>
          <p className="page-sub">Review demand and supply, then make the match by hand.</p>
        </div>
      </div>

      {forbidden && (
        <div className="empty">
          <div className="empty-ico">
            <ShieldAlert size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>Staff access only</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            This area is limited to platform administrators.
          </p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {loading && !forbidden && <LoadingState />}

      {queues && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Users size={20} />} value={queues.counts.users} label="Total users" />
            <StatCard
              icon={<UserCheck size={20} />}
              tone="green"
              value={queues.counts.surveyors}
              label="Surveyor profiles"
            />
            <StatCard
              icon={<Inbox size={20} />}
              tone="violet"
              value={queues.counts.openProjects}
              label="Projects awaiting a match"
            />
          </div>

          <section style={{ marginTop: 36 }}>
            <div className="section-title">
              Projects awaiting a match
              <span className="count">{queues.openProjects.length}</span>
            </div>
            {queues.openProjects.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">
                  <Inbox size={24} />
                </div>
                <h3 style={{ fontSize: 17 }}>Queue is clear</h3>
                <p style={{ color: 'var(--muted)', marginTop: 6 }}>
                  New projects will appear here the moment a client posts one.
                </p>
              </div>
            ) : (
              <div className="list stagger">
                {queues.openProjects.map((p) => (
                  <Link key={p.id} href={`/admin/projects/${p.id}`} className="plain">
                    <div className="row-item">
                      <div className="row-lead">
                        <span className="row-ico">
                          <Building2 size={18} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="row-title">{p.title}</div>
                          <div className="row-meta">
                            {p.clientName}
                            {p.locationText ? ` · ${p.locationText}` : ''} ·{' '}
                            {p.services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ')}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <StatusBadge status={p.status} />
                        <ArrowRight size={17} style={{ color: 'var(--faint)' }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 36 }}>
            <section>
              <div className="section-title">
                New surveyors
                <span className="count">{queues.recentSurveyors.length}</span>
              </div>
              {queues.recentSurveyors.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>No surveyor profiles yet.</p>
              ) : (
                <div className="list">
                  {queues.recentSurveyors.map((s) => (
                    <div className="row-item" key={s.profileId}>
                      <div className="row-lead">
                        <span className="row-ico" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
                          <UserCheck size={18} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="row-title">{s.fullName}</div>
                          <div className="row-meta">
                            {s.baseCity ?? 'No base city'} ·{' '}
                            {s.services.map((v) => SURVEY_SERVICE_LABELS[v]).join(', ')}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={s.isMatchable ? 'matchable' : 'paused'} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="section-title">
                New users
                <span className="count">{queues.recentUsers.length}</span>
              </div>
              <div className="list">
                {queues.recentUsers.map((u) => (
                  <div className="row-item" key={u.id}>
                    <div className="row-lead">
                      <span className="row-ico" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>
                        <Users size={18} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="row-title">{u.fullName}</div>
                        <div className="row-meta">{u.email}</div>
                      </div>
                    </div>
                    <span className="pill">{u.roleHint}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
