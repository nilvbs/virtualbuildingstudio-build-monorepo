'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Inbox,
  MapPin,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  SURVEY_SERVICE_LABELS,
  type AdminOverviewStats,
  type SurveyService,
} from '@surveylink/types';
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
  href,
}: {
  icon: ReactNode;
  tone?: 'sky' | 'sage' | 'peach' | 'lilac' | 'butter';
  value: number;
  label: string;
  detail?: string;
  href?: string;
}) {
  const className = `ops-metric${tone ? ` tone-${tone}` : ''}${href ? ' ops-metric-link' : ''}`;
  const body = (
    <>
      <div className="ops-metric-top">
        <span className="ops-metric-ico" aria-hidden>
          {icon}
        </span>
        {href ? (
          <span className="ops-metric-go" aria-hidden>
            <ArrowUpRight size={14} />
          </span>
        ) : null}
      </div>
      <p className="ops-metric-label">{label}</p>
      <div className="ops-metric-value">{value.toLocaleString()}</div>
      {detail ? <p className="ops-metric-detail">{detail}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <article className={className}>{body}</article>;
}

function LoadingState() {
  return (
    <div className="ops-metric-grid">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="ops-metric" key={i} aria-hidden>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
          <div className="skeleton sk-line" style={{ width: '48%', height: 12, marginTop: 16 }} />
          <div className="skeleton sk-line" style={{ width: '36%', height: 28, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/** Grouped bar chart with overlay trend line (7-day moving average of totals). */
function ActivityTrendChart({
  trend,
}: {
  trend: AdminOverviewStats['trend'];
}) {
  const width = 720;
  const height = 280;
  const pad = { top: 22, right: 18, bottom: 40, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxVal = Math.max(
    1,
    ...trend.map((d) => Math.max(d.clients, d.surveyors, d.projects)),
  );

  const n = Math.max(trend.length, 1);
  const groupW = innerW / n;
  const barW = Math.max(2.5, Math.min(11, groupW / 4));
  const gap = barW * 0.25;

  const totals = trend.map((d) => d.clients + d.surveyors + d.projects);
  const ma = totals.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = totals.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const maxTotal = Math.max(1, ...totals, ...ma);

  const yTotal = (v: number) => pad.top + innerH - (v / maxTotal) * innerH;

  const trendPath = ma
    .map((v, i) => {
      const x = pad.left + groupW * i + groupW / 2;
      const y = yTotal(v);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const tickEvery = Math.max(1, Math.ceil(n / 7));

  if (trend.length === 0) {
    return <div className="ops-empty">No trend data for the current filters.</div>;
  }

  return (
    <div className="ops-chart-wrap">
      <svg
        className="ops-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily clients, surveyors, and projects with trend line"
      >
        <defs>
          <linearGradient id="opsTrendFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4b5a0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#d4b5a0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t);
          return (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                className="ops-chart-grid"
              />
              <text x={pad.left - 10} y={y + 3.5} className="ops-chart-axis" textAnchor="end">
                {Math.round(maxVal * t)}
              </text>
            </g>
          );
        })}

        {trend.map((d, i) => {
          const x0 = pad.left + groupW * i + (groupW - barW * 3 - gap * 2) / 2;
          const bars = [
            { v: d.clients, cls: 'ops-bar-clients' },
            { v: d.surveyors, cls: 'ops-bar-surveyors' },
            { v: d.projects, cls: 'ops-bar-projects' },
          ];
          return (
            <g key={d.date}>
              {bars.map((b, bi) => {
                const h = (b.v / maxVal) * innerH;
                const x = x0 + bi * (barW + gap);
                const y = pad.top + innerH - h;
                return (
                  <rect
                    key={bi}
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(h, b.v > 0 ? 2 : 0)}
                    rx={2}
                    className={b.cls}
                  >
                    <title>{`${d.date}: ${b.v}`}</title>
                  </rect>
                );
              })}
              {i % tickEvery === 0 || i === n - 1 ? (
                <text
                  x={pad.left + groupW * i + groupW / 2}
                  y={height - 12}
                  className="ops-chart-axis"
                  textAnchor="middle"
                >
                  {d.date.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}

        <path d={trendPath} className="ops-chart-trend" fill="none" />
        {ma.map((v, i) => (
          <circle
            key={trend[i]?.date ?? i}
            cx={pad.left + groupW * i + groupW / 2}
            cy={yTotal(v)}
            r={2.4}
            className="ops-chart-trend-dot"
          />
        ))}
      </svg>
      <div className="ops-chart-legend">
        <span>
          <i className="ops-legend-swatch clients" /> Clients
        </span>
        <span>
          <i className="ops-legend-swatch surveyors" /> Surveyors
        </span>
        <span>
          <i className="ops-legend-swatch projects" /> Projects
        </span>
        <span>
          <i className="ops-legend-swatch trend" /> 7-day trend
        </span>
      </div>
    </div>
  );
}

function ServicesBarChart({
  services,
}: {
  services: AdminOverviewStats['services'];
}) {
  if (services.length === 0) {
    return <div className="ops-empty">No service coverage in the current scope.</div>;
  }

  const max = Math.max(1, ...services.map((s) => Math.max(s.surveyors, s.projects)));
  const rows = services.slice(0, 10);

  return (
    <div className="ops-svc-chart">
      {rows.map((row) => {
        const label = SURVEY_SERVICE_LABELS[row.service as SurveyService] ?? row.service;
        return (
          <div className="ops-svc-row" key={row.service}>
            <div className="ops-svc-label" title={label}>
              {label}
            </div>
            <div className="ops-svc-bars">
              <div className="ops-svc-track" title={`${row.surveyors} surveyors`}>
                <span
                  className="ops-svc-fill surveyors"
                  style={{ width: `${(row.surveyors / max) * 100}%` }}
                />
              </div>
              <div className="ops-svc-track" title={`${row.projects} projects`}>
                <span
                  className="ops-svc-fill projects"
                  style={{ width: `${(row.projects / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="ops-svc-counts">
              <span>{row.surveyors}</span>
              <span>{row.projects}</span>
            </div>
          </div>
        );
      })}
      <div className="ops-chart-legend ops-svc-legend">
        <span>
          <i className="ops-legend-swatch surveyors" /> Surveyors offering
        </span>
        <span>
          <i className="ops-legend-swatch projects" /> Projects requesting
        </span>
      </div>
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
          <h1 className="ops-title">Overview</h1>
          <p className="ops-lede">
            Marketplace pulse for{' '}
            <strong>{periodLabel.toLowerCase()}</strong>
            {location ? (
              <>
                {' '}
                in <strong>{displayLocation(location)}</strong>
              </>
            ) : (
              ' · all regions'
            )}
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
              <div>
                <h2 className="ops-block-title">Network snapshot</h2>
                <p className="ops-block-sub">Live inventory in the selected scope</p>
              </div>
            </div>
            <div className="ops-metric-grid">
              <Metric
                icon={<Users size={17} strokeWidth={1.75} />}
                tone="sky"
                value={stats.totals.clients}
                label="Clients"
                detail="Registered accounts"
              />
              <Metric
                icon={<UserCheck size={17} strokeWidth={1.75} />}
                tone="sage"
                value={stats.totals.surveyors}
                label="Surveyors"
                detail={`${stats.totals.matchableSurveyors} matchable`}
                href="/build/admin/surveyors"
              />
              <Metric
                icon={<CheckCircle2 size={17} strokeWidth={1.75} />}
                tone="lilac"
                value={stats.totals.completeSurveyors}
                label="Complete profiles"
                detail="100% portfolio filled"
                href="/build/admin/surveyors?quick=complete"
              />
              <Metric
                icon={<Briefcase size={17} strokeWidth={1.75} />}
                tone="peach"
                value={stats.totals.projects}
                label="Projects"
                detail="Total volume"
              />
              <Metric
                icon={<Inbox size={17} strokeWidth={1.75} />}
                tone="butter"
                value={stats.totals.openProjects}
                label="Open queue"
                detail="Pending assignment"
              />
            </div>
          </section>

          <div className="ops-split">
            <section className="ops-block ops-panel">
              <div className="ops-block-head">
                <div>
                  <h2 className="ops-block-title">Activity trend</h2>
                  <p className="ops-block-sub">
                    Daily adds · 7-day moving average · {periodLabel}
                  </p>
                </div>
              </div>
              <ActivityTrendChart trend={stats.trend} />
            </section>

            <section className="ops-block ops-panel">
              <div className="ops-block-head">
                <div>
                  <h2 className="ops-block-title">Services coverage</h2>
                  <p className="ops-block-sub">Supply vs demand by service</p>
                </div>
              </div>
              <ServicesBarChart services={stats.services} />
            </section>
          </div>

          <section className="ops-block">
            <div className="ops-block-head">
              <div>
                <h2 className="ops-block-title">Period activity</h2>
                <p className="ops-block-sub">New records in {periodLabel.toLowerCase()}</p>
              </div>
            </div>
            <div className="ops-metric-grid ops-metric-grid--3">
              <Metric
                icon={<Users size={17} strokeWidth={1.75} />}
                tone="sky"
                value={stats.period.clientsAdded}
                label="New clients"
                detail="Accounts created"
              />
              <Metric
                icon={<UserCheck size={17} strokeWidth={1.75} />}
                tone="sage"
                value={stats.period.surveyorsAdded}
                label="New surveyors"
                detail="Profiles created"
              />
              <Metric
                icon={<Briefcase size={17} strokeWidth={1.75} />}
                tone="peach"
                value={stats.period.projectsPosted}
                label="New projects"
                detail="Jobs posted"
              />
            </div>
          </section>

          <section className="ops-block ops-panel">
            <div className="ops-block-head">
              <div>
                <h2 className="ops-block-title">Regional distribution</h2>
                <p className="ops-block-sub">Select a region to focus the dashboard</p>
              </div>
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
