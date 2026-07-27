'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import {
  SURVEY_SERVICE_LABELS,
  type ClientSurveyorSort,
  type ClientSurveyorSummary,
  type ProjectDetail,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';

const PAGE_SIZE = 12;

type Filters = {
  q: string;
  minRating: string;
  bldVerified: boolean;
  radiusKm: string;
  minDayRate: string;
  maxDayRate: string;
  sort: ClientSurveyorSort;
};

const DEFAULT_FILTERS: Filters = {
  q: '',
  minRating: '',
  bldVerified: false,
  radiusKm: '100',
  minDayRate: '',
  maxDayRate: '',
  sort: 'relevance',
};

function formatRate(cents: number | null): string {
  if (cents == null) return 'Rate on request';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/day`;
}

function serviceLabel(s: SurveyService): string {
  return SURVEY_SERVICE_LABELS[s] ?? s.replaceAll('_', ' ');
}

export default function ProjectSurveyorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<ClientSurveyorSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>('0');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    api
      .getProject(id)
      .then(setProject)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      });
  }, [id, router]);

  const loadPage = useCallback(
    async (nextCursor: string | null, reset: boolean, active: Filters) => {
      if (nextCursor == null && !reset) return;
      if (loadingMoreRef.current && !reset) return;
      loadingMoreRef.current = true;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const page = await api.browseProjectSurveyors(id, {
          cursor: nextCursor ?? 0,
          limit: PAGE_SIZE,
          q: active.q || undefined,
          minRating: active.minRating ? Number(active.minRating) : undefined,
          bldVerified: active.bldVerified || undefined,
          radiusKm: active.radiusKm ? Number(active.radiusKm) : undefined,
          minDayRateCents: active.minDayRate
            ? Math.round(Number(active.minDayRate) * 100)
            : undefined,
          maxDayRateCents: active.maxDayRate
            ? Math.round(Number(active.maxDayRate) * 100)
            : undefined,
          sort: active.sort,
          // Project services stay as silent relevance defaults — not a user filter.
          services: project?.services?.length ? project.services : undefined,
        });
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setCursor(page.nextCursor);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [id, project?.services],
  );

  useEffect(() => {
    if (!project) return;
    void loadPage('0', true, applied);
  }, [project, applied, loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor && !loading && !loadingMore) {
          void loadPage(cursor, false, applied);
        }
      },
      { rootMargin: '240px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [cursor, loading, loadingMore, applied, loadPage]);

  function applyFilters() {
    setApplied({ ...filters });
    setFiltersOpen(false);
  }

  function resetFilters() {
    const next = { ...DEFAULT_FILTERS };
    setFilters(next);
    setApplied(next);
  }

  return (
    <div className="surveyor-discover">
      <Link href={`/client/projects/${id}`} className="project-detail-back plain">
        <ArrowLeft size={15} /> Project details
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">Find surveyors</h1>
          <p className="page-sub">
            {project
              ? `Matched to “${project.title}” by services and location. Refine with filters.`
              : 'Loading project…'}
          </p>
        </div>
        <button type="button" className="btn secondary sm" onClick={() => setFiltersOpen((v) => !v)}>
          <SlidersHorizontal size={15} /> Filters
        </button>
      </div>

      {filtersOpen ? (
        <section className="card discover-filters">
          <div className="discover-toolbar">
            <div className="discover-search">
              <Search size={16} strokeWidth={2.2} aria-hidden />
              <input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Search by name, city, or bio"
                aria-label="Search surveyors"
              />
            </div>

            <label className="discover-control">
              <span>Min rating</span>
              <select
                value={filters.minRating}
                onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))}
                aria-label="Minimum rating"
              >
                <option value="">Any rating</option>
                <option value="3">★★★☆☆  3+</option>
                <option value="4">★★★★☆  4+</option>
                <option value="4.5">★★★★★  4.5+</option>
              </select>
            </label>

            <label className="discover-control">
              <span>Distance</span>
              <div className="discover-suffix">
                <input
                  type="number"
                  min={1}
                  value={filters.radiusKm}
                  onChange={(e) => setFilters((f) => ({ ...f, radiusKm: e.target.value }))}
                />
                <em>km</em>
              </div>
            </label>

            <label className="discover-control">
              <span>Sort by</span>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sort: e.target.value as ClientSurveyorSort }))
                }
              >
                <option value="relevance">Best match</option>
                <option value="distance">Nearest</option>
                <option value="rating">Highest rated</option>
                <option value="price_asc">Budget: low → high</option>
                <option value="price_desc">Budget: high → low</option>
              </select>
            </label>

            <label className="discover-control">
              <span>Day rate</span>
              <div className="discover-range">
                <input
                  type="number"
                  min={0}
                  placeholder="Min $"
                  value={filters.minDayRate}
                  onChange={(e) => setFilters((f) => ({ ...f, minDayRate: e.target.value }))}
                />
                <span className="discover-range-sep">–</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Max $"
                  value={filters.maxDayRate}
                  onChange={(e) => setFilters((f) => ({ ...f, maxDayRate: e.target.value }))}
                />
              </div>
            </label>
          </div>

          <div className="discover-filter-footer">
            <label className="discover-check">
              <input
                type="checkbox"
                checked={filters.bldVerified}
                onChange={(e) => setFilters((f) => ({ ...f, bldVerified: e.target.checked }))}
              />
              BLD verified only
            </label>
            <div className="discover-filter-actions">
              <button type="button" className="btn secondary sm" onClick={resetFilters}>
                Reset
              </button>
              <button type="button" className="btn sm" onClick={applyFilters}>
                <Search size={15} /> Apply
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {error ? <div className="alert error">{error}</div> : null}

      <div className="section-title">
        Surveyors <span className="count">{total}</span>
      </div>

      {loading ? (
        <div className="discover-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card" style={{ height: 180 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <h2 style={{ fontSize: 18 }}>No surveyors match</h2>
          <p style={{ color: 'var(--muted)' }}>Try widening distance, budget, or services.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {items.map((s) => (
            <article key={s.profileId} className="discover-card">
              <div className="discover-card-top">
                <div className="discover-avatar">
                  {s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatarUrl} alt="" />
                  ) : (
                    <span>{s.fullName.slice(0, 1)}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="discover-name-row">
                    <strong>{s.fullName}</strong>
                    {s.bldVerified ? (
                      <span className="discover-verified" title="BLD verified">
                        <BadgeCheck size={15} />
                      </span>
                    ) : null}
                  </div>
                  <div className="discover-meta">
                    {s.baseCity ? (
                      <span>
                        <MapPin size={13} /> {s.baseCity}
                      </span>
                    ) : null}
                    {s.distanceKm != null ? <span>{s.distanceKm} km away</span> : null}
                  </div>
                </div>
                <div className="discover-rating">
                  <Star size={14} />
                  {s.ratingAvg != null ? s.ratingAvg.toFixed(1) : '—'}
                </div>
              </div>
              {s.bio ? <p className="discover-bio">{s.bio}</p> : null}
              <div className="chip-row">
                {s.services.slice(0, 4).map((svc) => (
                  <span key={svc} className="service-tag">
                    {serviceLabel(svc)}
                  </span>
                ))}
              </div>
              <div className="discover-card-foot">
                <span>{formatRate(s.dayRateCents)}</span>
                <span className="discover-score">Match {s.relevanceScore}%</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore ? <div className="discover-loading-more">Loading more…</div> : null}
      {!cursor && items.length > 0 ? (
        <div className="discover-loading-more">You’ve reached the end</div>
      ) : null}
    </div>
  );
}
