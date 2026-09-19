'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  UserCheck,
} from 'lucide-react';
import {
  SURVEY_SERVICES,
  SURVEY_SERVICE_LABELS,
  type AdminSurveyor,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';

type QuickFilter =
  | 'all'
  | 'complete'
  | 'incomplete'
  | 'matchable'
  | 'paused'
  | 'verified';

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

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'complete', label: 'Complete' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'matchable', label: 'Matchable' },
  { id: 'paused', label: 'Paused' },
  { id: 'verified', label: 'BLD verified' },
];

function parseQuick(value: string | null): QuickFilter {
  if (
    value === 'complete' ||
    value === 'incomplete' ||
    value === 'matchable' ||
    value === 'paused' ||
    value === 'verified'
  ) {
    return value;
  }
  return 'all';
}

export default function AdminSurveyorsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminSurveyorsPageInner />
    </Suspense>
  );
}

function AdminSurveyorsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [surveyors, setSurveyors] = useState<AdminSurveyor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [quick, setQuick] = useState<QuickFilter>(() => parseQuick(searchParams.get('quick')));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [q, setQ] = useState('');
  const [service, setService] = useState<SurveyService | ''>('');
  const [city, setCity] = useState('');
  const [minRating, setMinRating] = useState('');
  const [minDayRate, setMinDayRate] = useState('');
  const [maxDayRate, setMaxDayRate] = useState('');

  // Debounced search applied to API
  const [appliedQ, setAppliedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAppliedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const next = parseQuick(searchParams.get('quick'));
    setQuick(next);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const query: Parameters<typeof api.browseAdminSurveyors>[0] = {
      service: service || undefined,
      q: appliedQ || undefined,
      city: city.trim() || undefined,
      minRating: minRating ? Number(minRating) : undefined,
      minDayRateCents: minDayRate ? Math.round(Number(minDayRate) * 100) : undefined,
      maxDayRateCents: maxDayRate ? Math.round(Number(maxDayRate) * 100) : undefined,
    };

    if (quick === 'complete') query.complete = true;
    if (quick === 'incomplete') query.complete = false;
    if (quick === 'matchable') query.matchable = true;
    if (quick === 'paused') query.matchable = false;
    if (quick === 'verified') query.bldVerified = true;

    api
      .browseAdminSurveyors(query)
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
  }, [router, quick, service, appliedQ, city, minRating, minDayRate, maxDayRate]);

  const summary = useMemo(() => {
    if (!surveyors) return null;
    return {
      total: surveyors.length,
      complete: surveyors.filter((s) => s.profileComplete).length,
      matchable: surveyors.filter((s) => s.isMatchable).length,
    };
  }, [surveyors]);

  const advancedActive = Boolean(
    service || city.trim() || minRating || minDayRate || maxDayRate,
  );

  function applyQuick(id: QuickFilter) {
    setQuick(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id === 'all') params.delete('quick');
    else params.set('quick', id);
    const qs = params.toString();
    router.replace(qs ? `/build/admin/surveyors?${qs}` : '/build/admin/surveyors');
  }

  function clearAdvanced() {
    setService('');
    setCity('');
    setMinRating('');
    setMinDayRate('');
    setMaxDayRate('');
    setQ('');
  }

  return (
    <div className="admin-svy">
      {!forbidden && (
        <div className="admin-svy-bar">
          <div className="admin-svy-summary">
            <h2 className="admin-svy-heading">
              {loading || !summary
                ? 'Loading surveyors…'
                : summary.total === 0
                  ? 'No surveyors match'
                  : `${summary.total} surveyor${summary.total === 1 ? '' : 's'}`}
            </h2>
            {summary && summary.total > 0 ? (
              <p className="admin-svy-lede">
                {summary.complete} complete · {summary.matchable} matchable ·{' '}
                {summary.total - summary.matchable} paused
              </p>
            ) : (
              <p className="admin-svy-lede">
                See who filled their portfolio, which services they cover, and open the full profile.
              </p>
            )}
          </div>

          <label className="admin-svy-search">
            <Search size={15} strokeWidth={2} aria-hidden />
            <input
              type="search"
              placeholder="Search name, email, phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search surveyors"
            />
          </label>
        </div>
      )}

      {!forbidden && (
        <div className="admin-svy-quick">
          <div className="ops-seg" role="group" aria-label="Quick filters">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`ops-seg-btn${quick === f.id ? ' is-active' : ''}`}
                onClick={() => applyQuick(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`btn secondary sm admin-svy-adv-toggle${showAdvanced || advancedActive ? ' is-on' : ''}`}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal size={14} />
            Advanced
            <ChevronDown size={14} className={showAdvanced ? 'is-open' : undefined} />
          </button>
        </div>
      )}

      {showAdvanced && !forbidden ? (
        <div className="admin-svy-advanced">
          <label className="admin-svy-field">
            <span>Service</span>
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
          <label className="admin-svy-field">
            <span>City</span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Base city"
              aria-label="Filter by city"
            />
          </label>
          <label className="admin-svy-field">
            <span>Min rating</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              placeholder="0–5"
              aria-label="Minimum rating"
            />
          </label>
          <label className="admin-svy-field">
            <span>Min day rate ($)</span>
            <input
              type="number"
              min={0}
              value={minDayRate}
              onChange={(e) => setMinDayRate(e.target.value)}
              placeholder="e.g. 400"
              aria-label="Minimum day rate"
            />
          </label>
          <label className="admin-svy-field">
            <span>Max day rate ($)</span>
            <input
              type="number"
              min={0}
              value={maxDayRate}
              onChange={(e) => setMaxDayRate(e.target.value)}
              placeholder="e.g. 1200"
              aria-label="Maximum day rate"
            />
          </label>
          {advancedActive || q ? (
            <button type="button" className="btn secondary sm admin-svy-clear" onClick={clearAdvanced}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

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
          {surveyors.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">
                <UserCheck size={24} />
              </div>
              <h3 style={{ fontSize: 17 }}>No matches</h3>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>
                Try a different quick filter or clear advanced filters.
              </p>
            </div>
          ) : (
            <div className="admin-svy-list stagger">
              {surveyors.map((s) => {
                const services = s.services.slice(0, 4).map((v) => SURVEY_SERVICE_LABELS[v]);
                const extra = s.services.length - services.length;
                const rate =
                  s.dayRateCents != null ? `$${(s.dayRateCents / 100).toFixed(0)}/day` : null;
                return (
                  <article
                    className={`admin-svy-row${s.isMatchable ? ' is-matchable' : ' is-paused'}`}
                    key={s.profileId}
                  >
                    <Link
                      href={`/build/admin/surveyors/${s.profileId}`}
                      className="admin-svy-avatar plain"
                      aria-label={`Open ${s.fullName}`}
                    >
                      {initials(s.fullName)}
                    </Link>

                    <div className="admin-svy-main">
                      <div className="admin-svy-title-row">
                        <Link
                          href={`/build/admin/surveyors/${s.profileId}`}
                          className="admin-svy-name plain"
                        >
                          {s.fullName}
                        </Link>
                        <span className={`admin-svy-status ${s.isMatchable ? 'ok' : 'off'}`}>
                          <span className="dot-mini" />
                          {s.isMatchable ? 'Matchable' : 'Paused'}
                        </span>
                        {s.profileComplete ? (
                          <span className="admin-svy-complete">
                            <CheckCircle2 size={13} aria-hidden /> Complete
                          </span>
                        ) : (
                          <span className="admin-svy-complete is-partial">
                            {s.completionPercent}% filled
                          </span>
                        )}
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
                        {s.ratingAvg != null ? (
                          <span>
                            <Star size={13} aria-hidden />
                            {s.ratingAvg.toFixed(1)} ({s.ratingCount})
                          </span>
                        ) : null}
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
                        <div className="admin-svy-foot-right">
                          {rate ? <span className="admin-svy-rate">{rate}</span> : null}
                          <Link
                            href={`/build/admin/surveyors/${s.profileId}`}
                            className="btn secondary sm"
                          >
                            View profile
                          </Link>
                        </div>
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
