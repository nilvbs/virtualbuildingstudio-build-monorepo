'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Inbox,
  MapPin,
  UserCheck,
  Users,
} from 'lucide-react';
import type { AdminOverviewStats } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';

type DatePreset = 'all' | '7d' | '30d' | '90d' | 'custom';

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: DatePreset): { from?: string; to?: string } {
  if (preset === 'all' || preset === 'custom') return {};
  const to = new Date();
  const from = new Date();
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: toYmd(from), to: toYmd(to) };
}

function displayLocation(label: string): string {
  return label === 'Unknown' ? 'Unspecified' : label;
}

function Metric({
  icon,
  tone,
  value,
  label,
  detail,
}: {
  icon: ReactNode;
  tone?: string;
  value: number;
  label: string;
  detail?: string;
}) {
  return (
    <article className={`ops-metric${tone ? ` tone-${tone}` : ''}`}>
      <div className="ops-metric-top">
        <span className="ops-metric-ico" aria-hidden>
          {icon}
        </span>
        <span className="ops-metric-label">{label}</span>
      </div>
      <div className="ops-metric-value">{value.toLocaleString()}</div>
      {detail ? <p className="ops-metric-detail">{detail}</p> : null}
    </article>
  );
}

function LoadingState() {
  return (
    <div className="ops-metric-grid">
      {[0, 1, 2, 3].map((i) => (
        <div className="ops-metric" key={i} aria-hidden>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div className="skeleton sk-line" style={{ width: '42%', height: 28, marginTop: 14 }} />
          <div className="skeleton sk-line" style={{ width: '58%' }} />
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<DatePreset>('30d');
  const [from, setFrom] = useState(() => rangeForPreset('30d').from ?? '');
  const [to, setTo] = useState(() => rangeForPreset('30d').to ?? '');
  const [location, setLocation] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query =
      preset === 'all'
        ? { location: location || undefined }
        : {
            from: from || undefined,
            to: to || undefined,
            location: location || undefined,
          };

    api
      .getAdminOverview(query)
      .then((rows) => {
        if (!cancelled) {
          setStats(rows);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, preset, from, to, location]);

  const periodLabel = useMemo(() => {
    if (preset === 'all') return 'All time';
    if (preset === '7d') return 'Last 7 days';
    if (preset === '30d') return 'Last 30 days';
    if (preset === '90d') return 'Last 90 days';
    if (from && to) return `${from} – ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Through ${to}`;
    return 'Custom range';
  }, [preset, from, to]);

  const maxLocTotal = useMemo(() => {
    if (!stats?.locations.length) return 1;
    return Math.max(
      1,
      ...stats.locations.map((l) => l.clients + l.surveyors + l.projects),
    );
  }, [stats]);

  function applyPreset(next: DatePreset) {
    setPreset(next);
    if (next === 'all') {
      setFrom('');
      setTo('');
      return;
    }
    if (next === 'custom') return;
    const range = rangeForPreset(next);
    setFrom(range.from ?? '');
    setTo(range.to ?? '');
  }

  return (
    <div className="ops-overview">
      {error && <div className="alert error">{error}</div>}

      <header className="ops-toolbar">
        <div className="ops-toolbar-copy">
          <p className="ops-kicker">Operations</p>
          <h1 className="ops-title">Network analytics</h1>
          <p className="ops-lede">
            {periodLabel}
            {location ? ` · ${displayLocation(location)}` : ' · All regions'}
          </p>
        </div>

        <div className="ops-toolbar-controls">
          <div className="ops-seg" role="group" aria-label="Reporting period">
            {(
              [
                ['all', 'All'],
                ['7d', '7D'],
                ['30d', '30D'],
                ['90d', '90D'],
                ['custom', 'Custom'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`ops-seg-btn${preset === id ? ' is-active' : ''}`}
                onClick={() => applyPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'custom' ? (
            <div className="ops-date-pair">
              <label className="ops-control">
                <span>Start</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPreset('custom');
                    setFrom(e.target.value);
                  }}
                />
              </label>
              <label className="ops-control">
                <span>End</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPreset('custom');
                    setTo(e.target.value);
                  }}
                />
              </label>
            </div>
          ) : null}

          <label className="ops-control ops-control-region">
            <span>Region</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="Filter by region"
            >
              <option value="">All regions</option>
              {(stats?.availableLocations ?? []).map((loc) => (
                <option key={loc} value={loc}>
                  {displayLocation(loc)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {loading && !stats ? <LoadingState /> : null}

      {stats ? (
        <>
          <section className="ops-block">
            <div className="ops-block-head">
              <h2 className="ops-block-title">Network snapshot</h2>
              <p className="ops-block-sub">Current inventory in selected scope</p>
            </div>
            <div className="ops-metric-grid">
              <Metric
                icon={<Users size={18} />}
                value={stats.totals.clients}
                label="Clients"
                detail="Registered accounts"
              />
              <Metric
                icon={<UserCheck size={18} />}
                tone="green"
                value={stats.totals.surveyors}
                label="Surveyors"
                detail={`${stats.totals.matchableSurveyors} available for matching`}
              />
              <Metric
                icon={<Briefcase size={18} />}
                tone="violet"
                value={stats.totals.projects}
                label="Projects"
                detail="Total volume"
              />
              <Metric
                icon={<Inbox size={18} />}
                tone="amber"
                value={stats.totals.openProjects}
                label="Open queue"
                detail="Pending assignment"
              />
            </div>
          </section>

          <section className="ops-block">
            <div className="ops-block-head">
              <h2 className="ops-block-title">Period activity</h2>
              <p className="ops-block-sub">{periodLabel}</p>
            </div>
            <div className="ops-metric-grid ops-metric-grid--3">
              <Metric
                icon={<Users size={18} />}
                value={stats.period.clientsAdded}
                label="New clients"
                detail="Accounts created"
              />
              <Metric
                icon={<UserCheck size={18} />}
                tone="green"
                value={stats.period.surveyorsAdded}
                label="New surveyors"
                detail="Profiles created"
              />
              <Metric
                icon={<Briefcase size={18} />}
                tone="violet"
                value={stats.period.projectsPosted}
                label="New projects"
                detail="Jobs posted"
              />
            </div>
          </section>

          <section className="ops-block">
            <div className="ops-block-head">
              <h2 className="ops-block-title">Regional distribution</h2>
              <p className="ops-block-sub">Select a row to focus the dashboard</p>
            </div>
            {stats.locations.length === 0 ? (
              <div className="ops-empty">No regional data for the current filters.</div>
            ) : (
              <div className="ops-region">
                <div className="ops-region-head" aria-hidden>
                  <span>Region</span>
                  <span>Clients</span>
                  <span>Surveyors</span>
                  <span>Projects</span>
                  <span>Volume</span>
                </div>
                {stats.locations.map((row) => {
                  const total = row.clients + row.surveyors + row.projects;
                  const pct = Math.round((total / maxLocTotal) * 100);
                  const active = location === row.label;
                  return (
                    <button
                      type="button"
                      key={row.label}
                      className={`ops-region-row${active ? ' is-active' : ''}`}
                      onClick={() =>
                        setLocation((prev) => (prev === row.label ? '' : row.label))
                      }
                    >
                      <span className="ops-region-name">
                        <MapPin size={13} aria-hidden />
                        {displayLocation(row.label)}
                      </span>
                      <span className="ops-region-num">{row.clients}</span>
                      <span className="ops-region-num">{row.surveyors}</span>
                      <span className="ops-region-num">{row.projects}</span>
                      <span className="ops-region-vol">
                        <span className="ops-region-track">
                          <span className="ops-region-fill" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="ops-region-total">{total}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
