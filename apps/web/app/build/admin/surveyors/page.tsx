'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MapPin, Phone, Search, ShieldAlert, UserCheck } from 'lucide-react';
import { SURVEY_SERVICES, SURVEY_SERVICE_LABELS, type AdminSurveyor, type SurveyService } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function LoadingState() {
  return (
    <div className="admin-svy-list">
      {[0, 1, 2, 3].map((i) => (
        <div className="admin-svy-row" key={i} aria-hidden>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <div className="skeleton sk-line" style={{ width: '28%', height: 16 }} />
            <div className="skeleton sk-line" style={{ width: '52%' }} />
          </div>
          <div className="skeleton" style={{ width: 84, height: 24, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

export default function AdminSurveyorsPage() {
  const router = useRouter();
  const [surveyors, setSurveyors] = useState<AdminSurveyor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [service, setService] = useState<SurveyService | ''>('');

  useEffect(() => {
    setLoading(true);
    api
      .browseAdminSurveyors({ service: service || undefined })
      .then((rows) => {
        setSurveyors(rows);
        setForbidden(false);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router, service]);

  const filtered = useMemo(() => {
    if (!surveyors) return [];
    const term = q.trim().toLowerCase();
    if (!term) return surveyors;
    return surveyors.filter((s) =>
      [s.fullName, s.email, s.phone, s.baseCity ?? ''].join(' ').toLowerCase().includes(term),
    );
  }, [surveyors, q]);

  const matchableCount = useMemo(
    () => filtered.filter((s) => s.isMatchable).length,
    [filtered],
  );

  return (
    <div className="admin-svy">
      {!forbidden && (
        <div className="admin-svy-bar">
          <div className="admin-svy-summary">
            <h2 className="admin-svy-heading">
              {loading || !surveyors
                ? 'Loading surveyors…'
                : filtered.length === 0
                  ? q || service
                    ? 'No matches'
                    : 'No surveyors yet'
                  : `${filtered.length} surveyor${filtered.length === 1 ? '' : 's'}`}
            </h2>
            {surveyors && filtered.length > 0 ? (
              <p className="admin-svy-lede">
                {matchableCount} matchable · {filtered.length - matchableCount} paused
              </p>
            ) : (
              <p className="admin-svy-lede">Profiles, services, and match readiness.</p>
            )}
          </div>

          {surveyors && surveyors.length > 0 ? (
            <div className="admin-svy-filters">
              <label className="admin-svy-field">
                <span className="sr-only">Filter by service</span>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value as SurveyService | '')}
                  aria-label="Filter by service"
                >
                  <option value="">All services</option>
                  {SURVEY_SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {SURVEY_SERVICE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-svy-search">
                <Search size={15} strokeWidth={2} aria-hidden />
                <input
                  type="search"
                  placeholder="Search surveyors"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search surveyors"
                />
              </label>
            </div>
          ) : null}
        </div>
      )}

      {forbidden && (
        <div className="empty">
          <div className="empty-ico">
            <ShieldAlert size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>No access to surveyors</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Ask your super admin to grant the “View surveyors” permission.
          </p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {loading && !forbidden && <LoadingState />}

      {surveyors && !forbidden && (
        <>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">
                <UserCheck size={24} />
              </div>
              <h3 style={{ fontSize: 17 }}>{q || service ? 'No matches' : 'No surveyors yet'}</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>
                {q || service
                  ? 'Try a different name, city, or service filter.'
                  : 'Surveyor profiles appear here as soon as experts sign up.'}
              </p>
            </div>
          ) : (
            <div className="admin-svy-list stagger">
              {filtered.map((s) => {
                const services = s.services.slice(0, 4).map((v) => SURVEY_SERVICE_LABELS[v]);
                const extra = s.services.length - services.length;
                const rate =
                  s.dayRateCents != null ? `$${(s.dayRateCents / 100).toFixed(0)}/day` : null;
                return (
                  <article
                    className={`admin-svy-row${s.isMatchable ? ' is-matchable' : ' is-paused'}`}
                    key={s.profileId}
                  >
                    <span className="admin-svy-avatar" aria-hidden>
                      {initials(s.fullName)}
                    </span>

                    <div className="admin-svy-main">
                      <div className="admin-svy-title-row">
                        <h3 className="admin-svy-name">{s.fullName}</h3>
                        <span className={`admin-svy-status ${s.isMatchable ? 'ok' : 'off'}`}>
                          <span className="dot-mini" />
                          {s.isMatchable ? 'Matchable' : 'Paused'}
                        </span>
                      </div>

                      <div className="admin-svy-meta">
                        <span>
                          <Mail size={13} aria-hidden />
                          {s.email}
                        </span>
                        <span>
                          <Phone size={13} aria-hidden />
                          {s.phone}
                        </span>
                        <span>
                          <MapPin size={13} aria-hidden />
                          {s.baseCity || 'No base city'}
                        </span>
                      </div>

                      <div className="admin-svy-foot">
                        <div className="admin-svy-tags">
                          {services.length > 0 ? (
                            <>
                              {services.map((label) => (
                                <span className="admin-svy-tag" key={label}>
                                  {label}
                                </span>
                              ))}
                              {extra > 0 ? (
                                <span className="admin-svy-tag muted">+{extra}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="admin-svy-tag muted">No services set</span>
                          )}
                        </div>
                        {rate ? <span className="admin-svy-rate">{rate}</span> : null}
                      </div>
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
