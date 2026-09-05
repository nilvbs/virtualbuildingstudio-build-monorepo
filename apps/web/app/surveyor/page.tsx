'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle,
  Inbox,
  MapPin,
  Radar,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import {
  COVERAGE_COUNTRY_LABELS,
  SURVEYOR_PROFILE_COMPLETION_CHECKS,
  surveyorProfileCompletion,
  type CoverageCountryId,
  type SurveyorProfile,
  type SurveyorProfileCompletionKey,
  type SurveyorRequest,
  type SurveyorStatus,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/status';

const CoverageMapPreview = dynamic(
  () => import('../../components/coverage-map-preview').then((m) => m.CoverageMapPreview),
  {
    ssr: false,
    loading: () => <div className="svy-coverage-map svy-coverage-map--loading">Loading map…</div>,
  },
);

const PORTFOLIO_GATES: {
  id: string;
  label: string;
  blurb: string;
  keys: SurveyorProfileCompletionKey[];
}[] = [
  {
    id: 'services',
    label: 'Services',
    blurb: 'What you deliver on site',
    keys: ['services'],
  },
  {
    id: 'coverage',
    label: 'Coverage',
    blurb: 'ZIP codes and counties you cover',
    keys: ['baseCity', 'location'],
  },
  {
    id: 'commercial',
    label: 'Rates & kit',
    blurb: 'Pricing, gear, and availability',
    keys: ['equipment', 'availability', 'pricing'],
  },
  {
    id: 'work',
    label: 'Showcase',
    blurb: 'Experience, sectors, insurance',
    keys: ['yearsRealityCapture', 'industries', 'generalLiabilityInsurance'],
  },
];

const CHECK_LABEL = Object.fromEntries(
  SURVEYOR_PROFILE_COMPLETION_CHECKS.map((c) => [c.key, c.label]),
) as Record<SurveyorProfileCompletionKey, string>;

function LiveBucket({
  kind,
  locked,
}: {
  kind: 'requests' | 'matches';
  locked?: boolean;
}) {
  const isRequests = kind === 'requests';
  return (
    <div className={`svy-dash-live-bucket${locked ? ' is-locked' : ''}`}>
      <div className="svy-dash-live-radar" aria-hidden>
        <span />
        <span />
        <span />
        {isRequests ? <Inbox size={18} /> : <Radar size={18} />}
      </div>
      <div className="svy-dash-live-copy">
        <p className="svy-dash-live-status">
          <span className="svy-dash-live-dot" aria-hidden />
          {locked ? 'Waiting to unlock' : isRequests ? 'Open for requests' : 'Open for matches'}
        </p>
        <p>
          {locked
            ? isRequests
              ? 'Finish your portfolio to start receiving project requests here.'
              : 'Finish your portfolio to see matched projects here.'
            : isRequests
              ? 'Nothing in your inbox yet — new fitted requests will appear here.'
              : 'No matches yet — we’ll show fitted projects here as they come in.'}
        </p>
      </div>
    </div>
  );
}

function CompletionRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div
      className={`svy-dash-ring${clamped >= 100 ? ' is-full' : ''}${clamped > 0 ? ' is-live' : ''}`}
      role="img"
      aria-label={`Portfolio ${clamped}% complete`}
    >
      <svg className="svy-dash-ring-svg" viewBox="0 0 108 108" aria-hidden>
        <defs>
          <linearGradient id="svyDashRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a29bff" />
            <stop offset="55%" stopColor="#7168f6" />
            <stop offset="100%" stopColor="#5b52e0" />
          </linearGradient>
        </defs>
        <circle className="svy-dash-ring-track" cx="54" cy="54" r={r} />
        <circle
          className="svy-dash-ring-fill"
          cx="54"
          cy="54"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="svy-dash-ring-label">
        <strong>{clamped}%</strong>
        <span>{clamped >= 100 ? 'Ready' : 'Filled'}</span>
      </div>
    </div>
  );
}

export default function SurveyorDashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SurveyorStatus | null>(null);
  const [profile, setProfile] = useState<SurveyorProfile | null>(null);
  const [completionMissing, setCompletionMissing] = useState<SurveyorProfileCompletionKey[]>([]);
  const [requests, setRequests] = useState<SurveyorRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nextStatus, nextProfile] = await Promise.all([
          api.getSurveyorStatus(),
          api.getSurveyorProfile().catch((err) => {
            if (err instanceof ApiError && err.status === 404) return null;
            throw err;
          }),
        ]);
        if (cancelled) return;
        setStatus(nextStatus);
        setProfile(nextProfile);

        const selectedCounties = (nextProfile?.details?.coverageCounties ?? []).filter(
          (c) => c.selected !== false,
        );
        const fips = selectedCounties.map((c) => c.fips).filter((f): f is string => Boolean(f));
        if (fips.length > 0) {
          void import('../../lib/us-counties').then((m) => m.fetchCountyGeometriesByFips(fips));
        }

        const completion = surveyorProfileCompletion(
          nextProfile
            ? {
                services: nextProfile.services,
                equipment: nextProfile.equipment,
                baseCity: nextProfile.baseCity,
                location: nextProfile.location,
                dayRateCents: nextProfile.dayRateCents,
                details: nextProfile.details,
              }
            : null,
        );
        setCompletionMissing(completion.missing);

        if (nextStatus.profileComplete) {
          const nextRequests = await api.getSurveyorRequests().catch(() => [] as SurveyorRequest[]);
          if (cancelled) return;
          setRequests(nextRequests);
        } else {
          setRequests([]);
        }
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

  useEffect(() => {
    if (!status?.profileComplete) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [nextStatus, nextRequests] = await Promise.all([
          api.getSurveyorStatus(),
          api.getSurveyorRequests().catch(() => [] as SurveyorRequest[]),
        ]);
        if (cancelled) return;
        setStatus(nextStatus);
        setRequests(nextRequests);
      } catch {
        /* keep last good snapshot while live-checking */
      }
    };
    const id = window.setInterval(tick, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [status?.profileComplete]);

  const gates = useMemo(() => {
    const missing = new Set(completionMissing);
    return PORTFOLIO_GATES.map((gate) => {
      const pendingKeys = gate.keys.filter((k) => missing.has(k));
      return {
        ...gate,
        complete: pendingKeys.length === 0,
        pending: pendingKeys.map((k) => CHECK_LABEL[k]),
      };
    });
  }, [completionMissing]);

  const pendingGates = gates.filter((g) => !g.complete);
  const doneGateCount = gates.filter((g) => g.complete).length;

  const coverageCounties = useMemo(
    () => (profile?.details?.coverageCounties ?? []).filter((c) => c.selected !== false),
    [profile],
  );

  const coverageAreas = useMemo(() => {
    if (coverageCounties.length > 0) {
      return coverageCounties.map((c) => {
        const name = c.county.replace(/\s+County$/i, '');
        return c.state ? `${name} County, ${c.state}` : `${name} County`;
      });
    }
    const countries = profile?.details?.coverageCountries ?? [];
    const regions = profile?.details?.coverageRegions ?? {};
    const chips: string[] = [];
    for (const country of countries) {
      const id = country as CoverageCountryId;
      const selected = regions[id] ?? [];
      if (selected.length > 0) {
        for (const region of selected) chips.push(region);
      } else {
        chips.push(COVERAGE_COUNTRY_LABELS[id] ?? id);
      }
    }
    return chips;
  }, [profile, coverageCounties]);

  const coverageStates = useMemo(() => {
    return Array.from(new Set(coverageCounties.map((c) => c.state))).sort();
  }, [coverageCounties]);

  async function handleAccept(matchId: string) {
    setActing(matchId);
    try {
      await api.acceptMatch(matchId);
      setRequests((prev) => prev.filter((r) => r.matchId !== matchId));
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              matches: prev.matches.filter((m) => m.matchId !== matchId),
            }
          : prev,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(matchId: string) {
    setActing(matchId);
    try {
      await api.declineMatch(matchId);
      setRequests((prev) => prev.filter((r) => r.matchId !== matchId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="svy-dash">
        <div className="skeleton" style={{ height: 180, borderRadius: 20 }} />
        <div className="svy-dash-metrics">
          <div className="skeleton" style={{ height: 92, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 92, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 92, borderRadius: 16 }} />
        </div>
        <div className="skeleton" style={{ height: 260, borderRadius: 18 }} />
      </div>
    );
  }

  if (error && !status) return <div className="alert error">{error}</div>;
  if (!status) return null;

  const incomplete = !status.profileComplete;
  const percent = status.completionPercent;
  const firstPending = pendingGates[0]?.id;

  return (
    <div className="svy-dash">
      {error ? <div className="alert error">{error}</div> : null}

      <header className={`svy-dash-hero${incomplete ? ' is-pending' : ' is-live'}`}>
        <div className="svy-dash-hero-stage">
          <div className="svy-dash-hero-copy">
            <p className="svy-dash-kicker">{incomplete ? 'Almost there' : 'Live workspace'}</p>
            <h1 className="svy-dash-title">
              {incomplete ? 'Finish your portfolio' : status.headline}
            </h1>
            <p className="svy-dash-lede">
              {incomplete
                ? `${pendingGates.length} stage${pendingGates.length === 1 ? '' : 's'} still need details before matching unlocks.`
                : coverageCounties.length > 0
                  ? `Covering ${coverageCounties.length} count${coverageCounties.length === 1 ? 'y' : 'ies'}${coverageStates.length ? ` across ${coverageStates.length} state${coverageStates.length === 1 ? '' : 's'}` : ''}. When a project fits, we’ll match you.`
                  : status.subtext}
            </p>

            <div className="svy-dash-hero-actions">
              <Link
                className="btn"
                href={
                  incomplete && firstPending
                    ? `/surveyor/profile?step=${firstPending}`
                    : '/surveyor/profile'
                }
              >
                {incomplete ? 'Continue portfolio' : 'Edit portfolio'}
                <ArrowRight size={16} />
              </Link>
              <Link className="btn secondary" href="/surveyor/profile?step=coverage">
                <MapPin size={15} />
                {coverageCounties.length > 0 ? 'Edit coverage' : 'Coverage'}
              </Link>
              {!incomplete && !status.isMatchable ? (
                <span className="svy-dash-pill is-warn">Paused</span>
              ) : null}
              {!incomplete && status.isMatchable ? (
                <span className="svy-dash-pill is-ok">
                  <Radar size={14} /> Open
                </span>
              ) : null}
            </div>

            <div className="svy-dash-hero-facts">
              <div className="svy-dash-hero-fact">
                <span>Portfolio</span>
                <strong>{percent}%</strong>
              </div>
              <div className="svy-dash-hero-fact">
                <span>Counties</span>
                <strong>{coverageCounties.length > 0 ? coverageCounties.length : '—'}</strong>
              </div>
              <div className="svy-dash-hero-fact">
                <span>Requests</span>
                <strong>{incomplete ? 'Locked' : requests.length}</strong>
              </div>
              <div className="svy-dash-hero-fact">
                <span>Matches</span>
                <strong>{incomplete ? 'Locked' : status.matches.length}</strong>
              </div>
            </div>

            <div className="svy-dash-hero-ring-wrap">
              <CompletionRing percent={percent} />
            </div>
          </div>

          <div className="svy-dash-hero-map">
            <CoverageMapPreview
              className="svy-coverage-map--hero"
              lat={profile?.location?.lat ?? null}
              lng={profile?.location?.lng ?? null}
              radiusKm={profile?.radiusKm ?? 250}
              label={profile?.baseCity}
              areas={coverageAreas}
              showRadius={coverageCounties.length === 0}
              counties={coverageCounties}
            />
          </div>
        </div>
      </header>

      {incomplete ? (
        <div className="svy-dash-grid">
          <section className="svy-dash-panel svy-dash-panel--fill" aria-labelledby="svy-pending-title">
            <div className="svy-dash-panel-head">
              <div>
                <p className="svy-dash-kicker">Still needed</p>
                <h2 id="svy-pending-title" className="svy-dash-panel-title">
                  Pending portfolio items
                </h2>
              </div>
              <span className="svy-dash-count">{pendingGates.length}</span>
            </div>

            {doneGateCount > 0 ? (
              <div className="svy-dash-done-row" aria-label="Completed stages">
                {gates
                  .filter((g) => g.complete)
                  .map((gate) => (
                    <span key={gate.id} className="svy-dash-done-chip">
                      <Check size={12} strokeWidth={3} />
                      {gate.label}
                    </span>
                  ))}
              </div>
            ) : null}

            <div className="svy-dash-gates">
              {pendingGates.map((gate) => (
                <article key={gate.id} className="svy-dash-gate is-pending">
                  <div className="svy-dash-gate-top">
                    <span className="svy-dash-gate-index" aria-hidden>
                      <TriangleAlert size={13} strokeWidth={2.5} />
                    </span>
                    <div className="svy-dash-gate-copy">
                      <strong>{gate.label}</strong>
                      <span>{gate.blurb}</span>
                    </div>
                    <Link className="btn svy-dash-gate-btn" href={`/surveyor/profile?step=${gate.id}`}>
                      Fill
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                  <ul className="svy-dash-missing">
                    {gate.pending.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <aside className="svy-dash-panel svy-dash-panel--fill svy-dash-side-card">
            <div className="svy-dash-side-block">
              <div className="svy-dash-panel-head">
                <div>
                  <p className="svy-dash-kicker">Inbox</p>
                  <h2 className="svy-dash-panel-title">Requests</h2>
                </div>
              </div>
              <LiveBucket kind="requests" locked />
            </div>
            <div className="svy-dash-side-block">
              <div className="svy-dash-panel-head">
                <div>
                  <p className="svy-dash-kicker">Activity</p>
                  <h2 className="svy-dash-panel-title">Matches</h2>
                </div>
              </div>
              <LiveBucket kind="matches" locked />
            </div>
          </aside>
        </div>
      ) : (
        <div className="svy-dash-grid">
          <section className="svy-dash-panel svy-dash-panel--fill" aria-labelledby="svy-requests-title">
            <div className="svy-dash-panel-head">
              <div>
                <p className="svy-dash-kicker">Inbox</p>
                <h2 id="svy-requests-title" className="svy-dash-panel-title">
                  Project requests
                </h2>
              </div>
              <span className="svy-dash-count">{requests.length}</span>
            </div>

            {requests.length === 0 ? (
              <LiveBucket kind="requests" />
            ) : (
              <div className="svy-dash-requests">
                {requests.map((req) => (
                  <article key={req.matchId} className="svy-dash-request">
                    <div className="svy-dash-request-head">
                      <div>
                        <h3>{req.project.title}</h3>
                        <p>
                          {req.client.fullName}
                          {req.client.companyName ? ` · ${req.client.companyName}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="svy-dash-request-meta">
                      {req.project.locationText ? (
                        <span>
                          <MapPin size={13} /> {req.project.locationText}
                        </span>
                      ) : null}
                      {req.project.neededWithin ? <span>{req.project.neededWithin}</span> : null}
                    </div>
                    <div className="svy-dash-request-actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={acting === req.matchId}
                        onClick={() => handleAccept(req.matchId)}
                      >
                        <CheckCircle size={16} /> Accept
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={acting === req.matchId}
                        onClick={() => handleDecline(req.matchId)}
                      >
                        <XCircle size={16} /> Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="svy-dash-panel svy-dash-panel--fill" aria-labelledby="svy-matches-title">
            <div className="svy-dash-panel-head">
              <div>
                <p className="svy-dash-kicker">Activity</p>
                <h2 id="svy-matches-title" className="svy-dash-panel-title">
                  Recent matches
                </h2>
              </div>
              <span className="svy-dash-count">{status.matches.length}</span>
            </div>
            {status.matches.length === 0 ? (
              <LiveBucket kind="matches" />
            ) : (
              <ul className="svy-dash-matches">
                {status.matches.map((match) => (
                  <li key={match.matchId}>
                    <strong>{match.projectTitle}</strong>
                    <StatusBadge status={match.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
