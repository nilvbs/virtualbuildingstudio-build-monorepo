'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPinned,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  COVERAGE_REGIONS,
  DAILY_CAPTURE_CAPACITIES,
  DAILY_CAPTURE_CAPACITY_LABELS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_LABELS,
  INDUSTRIES_SERVED,
  INDUSTRY_LABELS,
  SURVEY_SERVICE_GROUPS,
  SURVEY_SERVICE_LABELS,
  emptyPortfolioDetails,
  normalizePortfolioDetails,
  surveyorProfileCompletion,
  type AccountType,
  type AvailabilityOption,
  type CoverageCountryId,
  type CoverageCountyEntry,
  type DailyCaptureCapacity,
  type EquipmentId,
  type IndustryServed,
  type SurveyService,
  type SurveyorPortfolioDetails,
  type SurveyorProfileCompletionKey,
  type TravelChargeOption,
} from '@surveylink/types';
import type { SurveyorProfileBody } from '@surveylink/api-client';
import { api, ApiError, errorMessage } from '../../../lib/api';
import {
  kmToMiles,
  lookupCountiesByZipRadius,
  mapboxToken,
  milesToKm,
} from '../../../lib/geocode';
import { IncompleteProfileModal } from '../../../components/profile-completion';
import { LordIcon } from '../../../components/lord-icon';
import { SurveyorIdentityFigure } from '../../../components/surveyor-identity-figure';

const CoverageMapPreview = dynamic(
  () => import('../../../components/coverage-map-preview').then((m) => m.CoverageMapPreview),
  {
    ssr: false,
    loading: () => (
      <div className="svy-coverage-map svy-coverage-map--loading">Loading map…</div>
    ),
  },
);

function parseCoord(value: string): number | null {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
}

function CompletionRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div
      className={`svy-ring${clamped > 0 ? ' is-live' : ''}${clamped >= 100 ? ' is-full' : ''}`}
      role="img"
      aria-label={`Portfolio ${clamped}% complete`}
    >
      <span className="svy-ring-glow" aria-hidden />
      <svg viewBox="0 0 108 108" className="svy-ring-svg">
        <defs>
          <linearGradient id="svyRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a29bff" />
            <stop offset="55%" stopColor="#7168f6" />
            <stop offset="100%" stopColor="#5b52e0" />
          </linearGradient>
        </defs>
        <circle className="svy-ring-track" cx="54" cy="54" r={r} />
        <circle
          className="svy-ring-fill"
          cx="54"
          cy="54"
          r={r}
          stroke="url(#svyRingGrad)"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="svy-ring-label">
        <strong>{clamped}%</strong>
        <span>ready</span>
      </div>
    </div>
  );
}

function dollarsFromCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return String(Math.round(cents / 100));
}

function centsFromDollars(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

type ProfileStepId = 'services' | 'coverage' | 'commercial' | 'work';

const PROFILE_STEP_KEYS: Record<ProfileStepId, SurveyorProfileCompletionKey[]> = {
  services: ['services'],
  coverage: ['baseCity', 'location'],
  commercial: ['equipment', 'availability', 'pricing'],
  work: ['yearsRealityCapture', 'industries', 'generalLiabilityInsurance'],
};

const PROFILE_PROMPT_SNOOZE_KEY = 'bld.surveyor.profilePromptSnoozed';

const PROFILE_STEPS: {
  id: ProfileStepId;
  label: string;
  shortLabel: string;
  blurb: string;
  beat: string;
}[] = [
  {
    id: 'services',
    label: 'Services',
    shortLabel: 'Services',
    blurb: 'What you deliver',
    beat: 'Tap every service you actually ship on site.',
  },
  {
    id: 'coverage',
    label: 'Coverage',
    shortLabel: 'Cover',
    blurb: 'Where you work',
    beat: 'Add ZIPs — counties load and show on the map.',
  },
  {
    id: 'commercial',
    label: 'Rates & kit',
    shortLabel: 'Rates',
    blurb: 'Pricing and gear',
    beat: 'Set rates and the kit that wins the brief.',
  },
  {
    id: 'work',
    label: 'Showcase',
    shortLabel: 'Work',
    blurb: 'Sectors and credentials',
    beat: 'Set experience, insurance, and the sectors you know.',
  },
];

const stepEase = [0.22, 0.61, 0.36, 1] as const;

export default function SurveyorProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('individual');

  const [services, setServices] = useState<SurveyService[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [baseCity, setBaseCity] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('50');
  const [dayRate, setDayRate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isMatchable, setIsMatchable] = useState(true);
  const [details, setDetails] = useState<SurveyorPortfolioDetails>(emptyPortfolioDetails());
  const [zipInput, setZipInput] = useState('');
  const [searchRadiusMiles, setSearchRadiusMiles] = useState(75);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const zipAbortRef = useRef<AbortController | null>(null);

  const RADIUS_OPTIONS = [25, 50, 75, 100, 150, 200] as const;

  useEffect(() => {
    Promise.all([
      api.me().catch(() => null),
      api.getSurveyorProfile().catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    ])
      .then(([user, profile]) => {
        const type = (user?.accountType as AccountType | undefined) ?? 'individual';
        setAccountType(type);
        if (!profile) {
          setMode('create');
          setDetails(emptyPortfolioDetails(type));
          return;
        }
        setMode('edit');
        setServices(profile.services);
        setEquipment(profile.equipment);
        setDayRate(dollarsFromCents(profile.dayRateCents));
        setIsMatchable(profile.isMatchable);
        const nextDetails = normalizePortfolioDetails(profile.details, type);
        if (!nextDetails.identity || nextDetails.identity.kind !== type) {
          nextDetails.identity = emptyPortfolioDetails(type).identity;
        }
        setDetails(nextDetails);
        const selectedCounties = (nextDetails.coverageCounties ?? []).filter(
          (c) => c.selected !== false,
        );
        if (selectedCounties.length > 0) {
          applyBaseFromCounties(nextDetails.coverageCounties ?? []);
          const fips = selectedCounties.map((c) => c.fips).filter((f): f is string => Boolean(f));
          if (fips.length > 0) {
            void import('../../../lib/us-counties').then((m) => m.fetchCountyGeometriesByFips(fips));
          }
        } else {
          setBaseCity(profile.baseCity ?? '');
          setRadiusMiles(String(Math.max(1, Math.round(kmToMiles(profile.radiusKm)))));
          setLat(profile.location ? String(profile.location.lat) : '');
          setLng(profile.location ? String(profile.location.lng) : '');
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (loading) return;
    const focus = searchParams.get('step') as ProfileStepId | null;
    if (!focus) return;
    const idx = PROFILE_STEPS.findIndex((s) => s.id === focus);
    if (idx >= 0) setStep(idx);
  }, [loading, searchParams]);

  const liveCompletion = useMemo(() => {
    const dayRateCents = centsFromDollars(dayRate);
    const location =
      lat.trim() && lng.trim() ? { lat: Number(lat), lng: Number(lng) } : null;
    return surveyorProfileCompletion({
      services,
      equipment,
      baseCity,
      location,
      dayRateCents,
      details,
    });
  }, [services, equipment, baseCity, lat, lng, dayRate, details]);

  const stepFill = useMemo(() => {
    const missing = new Set(liveCompletion.missing);
    return PROFILE_STEPS.map((s) => {
      const keys = PROFILE_STEP_KEYS[s.id];
      const incomplete = keys.some((k) => missing.has(k));
      return { id: s.id, complete: !incomplete, incomplete };
    });
  }, [liveCompletion.missing]);

  const firstIncompleteStep = useMemo(
    () => stepFill.findIndex((s) => s.incomplete),
    [stepFill],
  );

  const canSubmit = services.length > 0 && !busy;
  const currentStep = PROFILE_STEPS[step]!;
  const isLastStep = step === PROFILE_STEPS.length - 1;
  const reduceMotion = useReducedMotion();
  const [figureMood, setFigureMood] = useState<'waiting' | 'running' | 'done'>('waiting');
  const [walkerX, setWalkerX] = useState(0);
  const [walkerReady, setWalkerReady] = useState(false);
  const travelRef = useRef(false);
  const TRAVEL_SEC = reduceMotion ? 0 : 2.8;

  const stepperWrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const wrap = stepperWrapRef.current;
    const active = stepRefs.current[step];
    if (!wrap || !active || wrap.scrollWidth <= wrap.clientWidth) return;
    wrap.scrollTo({
      left: Math.max(0, active.offsetLeft - 12),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [step, reduceMotion]);

  useEffect(() => {
    if (liveCompletion.complete && figureMood !== 'running') setFigureMood('done');
  }, [liveCompletion.complete, figureMood]);

  const measureWalker = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const w = track.clientWidth;
    const denom = Math.max(PROFILE_STEPS.length - 1, 1);
    const pad = 28;
    setWalkerX(pad + (step / denom) * Math.max(w - pad * 2, 0));
    setWalkerReady(true);
  }, [step]);

  useLayoutEffect(() => {
    measureWalker();
  }, [measureWalker]);

  useEffect(() => {
    const onResize = () => measureWalker();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureWalker]);

  function goToStep(next: number) {
    const clamped = Math.max(0, Math.min(PROFILE_STEPS.length - 1, next));
    if (clamped === step || figureMood === 'running') return;
    if (clamped > step && !reduceMotion) {
      travelRef.current = true;
      setFigureMood('running');
      setStep(clamped);
      return;
    }
    travelRef.current = false;
    setStep(clamped);
    setFigureMood(liveCompletion.complete ? 'done' : 'waiting');
  }

  function onWalkerArrived() {
    if (!travelRef.current) return;
    travelRef.current = false;
    // Land on the building after the cruise/scan.
    setFigureMood(liveCompletion.complete ? 'done' : 'waiting');
  }

  function patchDetails(patch: Partial<SurveyorPortfolioDetails>) {
    setDetails((current) => ({ ...current, ...patch }));
  }

  function matchCoverageState(stateName: string): string | null {
    const regions = COVERAGE_REGIONS.us;
    const exact = regions.find((r) => r.toLowerCase() === stateName.trim().toLowerCase());
    return exact ?? null;
  }

  function applyBaseFromCounties(counties: CoverageCountyEntry[]) {
    const selected = counties.filter((c) => c.selected !== false);
    if (selected.length === 0) {
      setBaseCity('');
      setLat('');
      setLng('');
      setRadiusMiles('50');
      return;
    }

    const primary = selected[0]!;
    setBaseCity(`${primary.county}, ${primary.state}`);
    setLat(primary.lat.toFixed(6));
    setLng(primary.lng.toFixed(6));

    // Derive a radius that roughly covers all selected county bboxes from the primary center.
    let maxKm = 40;
    for (const county of selected) {
      const points: Array<[number, number]> = [[county.lng, county.lat]];
      if (county.bbox) {
        const [west, south, east, north] = county.bbox;
        points.push([west, south], [east, south], [east, north], [west, north]);
      }
      for (const [x, y] of points) {
        const dLat = ((y - primary.lat) * Math.PI) / 180;
        const dLng = ((x - primary.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((primary.lat * Math.PI) / 180) *
            Math.cos((y * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
        if (km > maxKm) maxKm = km;
      }
    }
    setRadiusMiles(String(Math.max(15, Math.round(kmToMiles(maxKm * 1.15)))));
  }

  function syncCoverageFromCounties(counties: CoverageCountyEntry[]) {
    const selected = counties.filter((c) => c.selected !== false);
    const regions = Array.from(
      new Set(
        selected
          .map((c) => matchCoverageState(c.state))
          .filter((s): s is string => Boolean(s)),
      ),
    );
    applyBaseFromCounties(counties);
    return {
      coverageCountries: (selected.length > 0 ? ['us'] : []) as CoverageCountryId[],
      coverageRegions: regions.length > 0 ? { us: regions } : {},
      coverageCounties: counties,
    };
  }

  async function searchCoverageByRadius() {
    const raw = zipInput.trim();
    if (!raw) return;
    setZipError(null);
    setZipBusy(true);
    zipAbortRef.current?.abort();
    const controller = new AbortController();
    zipAbortRef.current = controller;
    try {
      const result = await lookupCountiesByZipRadius(raw, searchRadiusMiles, controller.signal);
      if (!result) {
        setZipError(
          !mapboxToken()
            ? 'Mapbox token is required to look up ZIP counties.'
            : 'Could not find counties for that ZIP and distance. Try another ZIP.',
        );
        return;
      }
      if (result.counties.length === 0) {
        setZipError('No counties found within that distance. Try a larger radius.');
        return;
      }

      const nextEntries: CoverageCountyEntry[] = result.counties.map((hit) => ({
        zip: result.zip,
        county: hit.county,
        state: hit.state,
        country: 'us' as const,
        lat: hit.lat,
        lng: hit.lng,
        bbox: hit.bbox,
        polygon: null,
        fips: hit.fips,
        selected: true,
      }));

      setDetails((current) => {
        const existing = current.coverageCounties ?? [];
        const merged = [...existing];
        for (const entry of nextEntries) {
          const key = entry.fips
            ? `fips:${entry.fips}`
            : `${entry.county.toLowerCase()}|${entry.state.toLowerCase()}`;
          const idx = merged.findIndex((c) =>
            entry.fips
              ? c.fips === entry.fips
              : `${c.county.toLowerCase()}|${c.state.toLowerCase()}` === key,
          );
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...entry, selected: true };
          } else {
            merged.push(entry);
          }
        }
        return { ...current, ...syncCoverageFromCounties(merged) };
      });
      setLat(result.lat.toFixed(6));
      setLng(result.lng.toFixed(6));
      setRadiusMiles(String(result.radiusMiles));
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setZipError('County lookup failed. Try again in a moment.');
    } finally {
      setZipBusy(false);
    }
  }

  function removeCounty(county: string, state: string, fips?: string | null) {
    setDetails((current) => {
      const next = (current.coverageCounties ?? []).filter((c) => {
        if (fips && c.fips) return c.fips !== fips;
        return !(c.county === county && c.state === state);
      });
      return { ...current, ...syncCoverageFromCounties(next) };
    });
  }

  function removeStateGroup(state: string) {
    setDetails((current) => {
      const next = (current.coverageCounties ?? []).filter((c) => c.state !== state);
      return { ...current, ...syncCoverageFromCounties(next) };
    });
  }

  function removeAllCounties() {
    setDetails((current) => ({ ...current, ...syncCoverageFromCounties([]) }));
  }

  useEffect(() => {
    if (currentStep.id !== 'coverage') return;
    void import('../../../lib/us-counties').then((m) => m.preloadCountyIndex().catch(() => null));
  }, [currentStep.id]);

  const selectedCounties = useMemo(
    () => (details.coverageCounties ?? []).filter((c) => c.selected !== false),
    [details.coverageCounties],
  );

  const countiesByState = useMemo(() => {
    const map = new Map<string, CoverageCountyEntry[]>();
    for (const county of selectedCounties) {
      const list = map.get(county.state) ?? [];
      list.push(county);
      map.set(county.state, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selectedCounties]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const body: SurveyorProfileBody = {
      services,
      equipment,
      bio: undefined,
      baseCity: baseCity.trim() || undefined,
      radiusKm: Math.max(1, Math.round(milesToKm(Number(radiusMiles) || 15))),
      details,
      isMatchable: liveCompletion.complete ? isMatchable : false,
    };
    const dayRateCents = centsFromDollars(dayRate);
    if (dayRateCents != null) body.dayRateCents = dayRateCents;
    if (lat.trim() && lng.trim()) body.location = { lat: Number(lat), lng: Number(lng) };

    try {
      if (mode === 'edit') await api.updateSurveyorProfile(body);
      else await api.createSurveyorProfile(body);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bld:surveyor-profile-saved'));
      }
      if (liveCompletion.complete) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(PROFILE_PROMPT_SNOOZE_KEY);
        }
        router.push('/surveyor');
        return;
      }
      // Stay on portfolio and show the incomplete modal; snooze shell so it
      // does not open a second copy of the same dialog.
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(PROFILE_PROMPT_SNOOZE_KEY, '1');
      }
      setShowIncompleteModal(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function dismissIncompleteModal() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PROFILE_PROMPT_SNOOZE_KEY, '1');
    }
    setShowIncompleteModal(false);
  }

  function continueIncompletePortfolio() {
    setShowIncompleteModal(false);
    if (firstIncompleteStep >= 0) goToStep(firstIncompleteStep);
  }

  if (loading) {
    return (
      <div className="svy-profile">
        <div className="svy-profile-hero skeleton" style={{ height: 168 }} />
        <div className="svy-profile-grid">
          <div className="skeleton" style={{ height: 280, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 280, borderRadius: 18 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="svy-profile">
      <div className="svy-progress-unit">
      <motion.header
        className={`svy-profile-hero is-scanning${liveCompletion.complete ? ' is-complete' : ''}`}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: stepEase }}
      >
        <div className="svy-skyline-bg" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/profile-skyline-bg.png" alt="" draggable={false} />
          <span className="svy-skyline-veil" />
        </div>

        <div className="svy-hero-intro">
          <p className="svy-profile-kicker">Portfolio setup</p>
          {!liveCompletion.complete ? (
            <p className="svy-hero-blurb">{currentStep.beat}</p>
          ) : null}
        </div>

        <div className="svy-eta-mid">
          <p className="svy-eta-meta">{liveCompletion.percent}% filled</p>
          <div
            className="svy-eta-track"
            ref={trackRef}
            style={{ ['--svy-progress' as string]: String(Math.max(liveCompletion.percent, 4) / 100) }}
            aria-hidden
          >
            <motion.i
              animate={{ width: `${Math.max(liveCompletion.percent, 2)}%` }}
              transition={{ duration: 0.45, ease: stepEase }}
            />
            {walkerReady ? (
              <motion.div
                className={`svy-walker-slot is-scanning${figureMood === 'running' ? ' is-moving' : ''}`}
                initial={false}
                animate={{ x: walkerX }}
                transition={{
                  duration: figureMood === 'running' ? TRAVEL_SEC : reduceMotion ? 0 : 0.4,
                  ease: [0.4, 0.05, 0.2, 1],
                }}
                onAnimationComplete={onWalkerArrived}
              >
                <span className="svy-building-scan" aria-hidden>
                  <span className="svy-building-scan-glow" />
                  <span className="svy-building-scan-raster" />
                  <span className="svy-building-scan-grid" />
                </span>
                <span className="svy-laser-cone" />
                <span className="svy-laser-core" />
                <span className="svy-laser-hit" />
                <SurveyorIdentityFigure step={step} mood={figureMood === 'done' ? 'waiting' : figureMood} />
              </motion.div>
            ) : null}
          </div>
        </div>

        <CompletionRing percent={liveCompletion.percent} />
      </motion.header>

      <div className="svy-stepper-wrap" ref={stepperWrapRef}>
        <ol className="svy-stepper" aria-label="Portfolio stages">
          {PROFILE_STEPS.map((s, i) => {
            const fill = stepFill[i]!;
            return (
            <li
              key={s.id}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={i === step ? 'is-here' : undefined}
            >
              <button
                type="button"
                className={`svy-stepper-item${i === step ? ' is-active' : ''}${fill.complete ? ' is-complete' : ''}${fill.incomplete ? ' is-incomplete' : ''}`}
                onClick={() => goToStep(i)}
                disabled={figureMood === 'running'}
                aria-label={
                  fill.incomplete
                    ? `${s.label} — details still needed`
                    : fill.complete
                      ? `${s.label} — complete`
                      : s.label
                }
              >
                <span className="svy-stepper-index" aria-hidden>
                  {fill.complete ? (
                    <LordIcon name="check" size={18} trigger="in" />
                  ) : fill.incomplete ? (
                    <TriangleAlert size={13} strokeWidth={2.5} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="svy-stepper-copy">
                  <strong>
                    <span className="svy-step-label-full">{s.label}</span>
                    <span className="svy-step-label-short">{s.shortLabel}</span>
                  </strong>
                </span>
              </button>
            </li>
            );
          })}
        </ol>
      </div>
      </div>

      <form className="svy-profile-form" onSubmit={onSubmit} noValidate>
        {error && <div className="alert error">{error}</div>}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            className="svy-step-stage"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
        {currentStep.id === 'services' ? (
          <div className="svy-q-stack">
              {SURVEY_SERVICE_GROUPS.map((group, gi) => (
                <section key={group.id} className="svy-q">
                  <div className="svy-q-head">
                    <span className="svy-q-num">{gi + 1}</span>
                    <div>
                      <h2>{group.label}</h2>
                      <p>Choose all that apply.</p>
                    </div>
                  </div>
                  <div className="svy-q-body">
                    <div className="svy-opts">
                    {group.services.map((s) => {
                      const selected = services.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`svy-opt${selected ? ' is-on' : ''}`}
                          aria-pressed={selected}
                          onClick={() => setServices((prev) => toggleInList(prev, s))}
                        >
                          <span className="svy-opt-mark" aria-hidden>
                            {selected ? <Check size={11} strokeWidth={3} /> : null}
                          </span>
                          <span>{SURVEY_SERVICE_LABELS[s]}</span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </section>
              ))}
          </div>
        ) : currentStep.id === 'coverage' ? (
          <div className="svy-coverage">
            <section className="svy-panel svy-area-panel">
              <div className="svy-panel-head">
                <span className="svy-q-num">2</span>
                <div>
                  <h2>Service coverage</h2>
                  <p>Tell us about your service area so we can find you the right projects.</p>
                </div>
              </div>

              <div className="svy-area-layout">
                <div className="svy-area-main">
                  <div className="svy-area-search">
                    <div className="svy-area-search-title">
                      <span className="svy-area-search-icon" aria-hidden>
                        <MapPinned size={22} strokeWidth={2.2} />
                      </span>
                      <div>
                        <strong>Find counties by radius</strong>
                        <p>Search from a postal code and keep the counties you cover.</p>
                      </div>
                    </div>
                    <div className="svy-area-search-row">
                      <label className="svy-area-field">
                        <span>Distance</span>
                        <select
                          value={searchRadiusMiles}
                          disabled={zipBusy}
                          onChange={(e) => setSearchRadiusMiles(Number(e.target.value))}
                        >
                          {RADIUS_OPTIONS.map((miles) => (
                            <option key={miles} value={miles}>
                              {miles} Miles
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="svy-area-field svy-area-field--grow">
                        <span>of Postal Code</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={10}
                          value={zipInput}
                          disabled={zipBusy}
                          onChange={(e) => {
                            setZipError(null);
                            setZipInput(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void searchCoverageByRadius();
                            }
                          }}
                          placeholder="75038"
                        />
                      </label>
                      <button
                        type="button"
                        className="btn primary svy-area-search-btn"
                        disabled={zipBusy || !zipInput.trim()}
                        onClick={() => void searchCoverageByRadius()}
                      >
                        {zipBusy ? 'Searching…' : 'Search'}
                      </button>
                    </div>
                    {zipBusy ? (
                      <p className="svy-zip-status" role="status">
                        Finding counties within {searchRadiusMiles} miles…
                      </p>
                    ) : null}
                    {zipError ? (
                      <p className="svy-zip-error" role="alert">
                        {zipError}
                      </p>
                    ) : null}
                  </div>

                  <div className="svy-area-body">
                    <div className="svy-area-map">
                      <CoverageMapPreview
                        className="svy-coverage-map--profile"
                        lat={parseCoord(lat)}
                        lng={parseCoord(lng)}
                        radiusKm={Math.max(1, Math.round(milesToKm(Number(radiusMiles) || searchRadiusMiles)))}
                        label={baseCity || null}
                        showRadius={false}
                        counties={selectedCounties}
                        areas={selectedCounties.map((c) => c.county.replace(/\s+County$/i, ''))}
                      />
                    </div>
                  </div>
                </div>

                <aside className="svy-area-selected">
                  <div className="svy-area-selected-head">
                    <strong>Selected Counties:</strong>
                    {selectedCounties.length > 0 ? (
                      <button type="button" className="svy-area-link" onClick={removeAllCounties}>
                        Remove All
                      </button>
                    ) : null}
                  </div>
                  {countiesByState.length === 0 ? (
                    <p className="svy-area-empty">Search a ZIP to load counties on the map.</p>
                  ) : (
                    countiesByState.map(([state, counties]) => (
                      <div key={`sel-${state}`} className="svy-area-selected-group">
                        <div className="svy-area-selected-group-head">
                          <span>
                            {state} {counties.length} Selected
                          </span>
                          <button
                            type="button"
                            className="svy-area-link"
                            onClick={() => removeStateGroup(state)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="svy-area-state-chips">
                          {counties.map((county) => (
                            <span
                              key={`sel-${county.fips ?? `${county.county}-${county.state}`}`}
                              className="svy-area-chip"
                            >
                              {county.county.replace(/\s+County$/i, '')}
                              <button
                                type="button"
                                aria-label={`Remove ${county.county}`}
                                onClick={() =>
                                  removeCounty(county.county, county.state, county.fips)
                                }
                              >
                                <X size={12} strokeWidth={2.5} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </aside>
              </div>

              <div className="field svy-area-capacity">
                <label htmlFor="dailyCapture">
                  Typical daily capture capacity <span className="req">*</span>
                </label>
                <p className="svy-field-hint">Approximate sq ft/day with your primary equipment.</p>
                <select
                  id="dailyCapture"
                  value={details.dailyCaptureCapacity ?? ''}
                  onChange={(e) =>
                    patchDetails({
                      dailyCaptureCapacity: (e.target.value || null) as DailyCaptureCapacity | null,
                    })
                  }
                >
                  <option value="">Select a range...</option>
                  {DAILY_CAPTURE_CAPACITIES?.map((id) => (
                    <option key={id} value={id}>
                      {DAILY_CAPTURE_CAPACITY_LABELS?.[id] ?? id}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="svy-panel svy-panel-side">
              <div className="svy-panel-head">
                <span className="svy-q-num">3</span>
                <div>
                  <h2>Availability</h2>
                  <p>How soon you can start</p>
                </div>
              </div>
              <div className="svy-avail">
                {AVAILABILITY_OPTIONS.map((option) => {
                  const selected = details.availability === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`svy-opt${selected ? ' is-on' : ''}`}
                      onClick={() =>
                        patchDetails({ availability: option as AvailabilityOption })
                      }
                    >
                      <span className="svy-opt-mark" aria-hidden>
                        {selected ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span>{AVAILABILITY_LABELS[option]}</span>
                    </button>
                  );
                })}
              </div>
              {details.availability === 'busy_until' ? (
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="busyUntil">Busy until</label>
                  <input
                    id="busyUntil"
                    type="date"
                    value={details.busyUntil ?? ''}
                    onChange={(e) => patchDetails({ busyUntil: e.target.value || null })}
                  />
                </div>
              ) : null}
              <p className="svy-geo-label" style={{ marginTop: 18 }}>Travel &amp; remote</p>
              <div className="svy-avail">
                {(
                  [
                    ['travelNationwide', 'Travel nationwide'],
                    ['internationalProjects', 'International projects'],
                    ['remoteServices', 'Remote services'],
                  ] as const
                ).map(([key, label]) => {
                  const on = Boolean(details[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`svy-opt${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => patchDetails({ [key]: !on })}
                    >
                      <span className="svy-opt-mark" aria-hidden>
                        {on ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : currentStep.id === 'commercial' ? (
          <div className="svy-profile-grid svy-profile-grid-wide">
            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <LordIcon name="coins" size={22} trigger="in" />
                </span>
                <div>
                  <h2>4. Pricing</h2>
                  <p>Rates and travel charges</p>
                </div>
              </div>
              <div className="svy-fields">
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <input
                    id="currency"
                    value={details.currency}
                    onChange={(e) => patchDetails({ currency: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="hourly">Hourly rate</label>
                  <div className="svy-money">
                    <span>$</span>
                    <input
                      id="hourly"
                      type="number"
                      min={0}
                      value={dollarsFromCents(details.hourlyRateCents)}
                      onChange={(e) =>
                        patchDetails({ hourlyRateCents: centsFromDollars(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="dayRate">Daily rate</label>
                  <div className="svy-money">
                    <span>$</span>
                    <input
                      id="dayRate"
                      type="number"
                      min={0}
                      value={dayRate}
                      onChange={(e) => setDayRate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="minProject">Minimum project value</label>
                  <div className="svy-money">
                    <span>$</span>
                    <input
                      id="minProject"
                      type="number"
                      min={0}
                      value={dollarsFromCents(details.minimumProjectCents)}
                      onChange={(e) =>
                        patchDetails({
                          minimumProjectCents: centsFromDollars(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="field svy-field-span">
                  <label>Travel charges</label>
                  <div className="svy-travel-row">
                    <label className="svy-travel-opt">
                      <input
                        type="radio"
                        name="travelCharges"
                        checked={details.travelCharges === 'included'}
                        onChange={() =>
                          patchDetails({
                            travelCharges: 'included',
                            travelExtraCents: null,
                          })
                        }
                      />
                      Included
                    </label>
                    <label className="svy-travel-opt">
                      <input
                        type="radio"
                        name="travelCharges"
                        checked={details.travelCharges === 'extra'}
                        onChange={() =>
                          patchDetails({
                            travelCharges: 'extra',
                            travelExtraCents: details.travelExtraCents,
                          })
                        }
                      />
                      Extra
                    </label>
                    {details.travelCharges === 'extra' ? (
                      <>
                        <span className="svy-travel-extra-label" id="travelExtraLabel">
                          Extra cost
                        </span>
                        <div className="svy-money svy-travel-extra-money">
                          <span>$</span>
                          <input
                            id="travelExtra"
                            type="number"
                            min={0}
                            inputMode="decimal"
                            placeholder="0"
                            aria-labelledby="travelExtraLabel"
                            value={dollarsFromCents(details.travelExtraCents)}
                            onChange={(e) =>
                              patchDetails({
                                travelExtraCents: centsFromDollars(e.target.value),
                              })
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="svy-panel svy-panel-span">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <LordIcon name="tools" size={22} trigger="in" />
                </span>
                <div>
                  <h2>5. Equipment</h2>
                  <p>Select from catalog</p>
                </div>
              </div>
              {EQUIPMENT_GROUPS.map((group) => (
                <div key={group.id} className="svy-group">
                  <h3 className="svy-group-title">{group.label}</h3>
                  <div className="svy-opts">
                    {group.items.map((id) => {
                      const selected = equipment.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`svy-opt${selected ? ' is-on' : ''}`}
                          aria-pressed={selected}
                          onClick={() => setEquipment((prev) => toggleInList(prev, id))}
                        >
                          <span className="svy-opt-mark" aria-hidden>
                            {selected ? <Check size={11} strokeWidth={3} /> : null}
                          </span>
                          <span>{EQUIPMENT_LABELS[id as EquipmentId]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <div className="svy-profile-grid svy-profile-grid-wide">
            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <LordIcon name="clock" size={22} trigger="in" />
                </span>
                <div>
                  <h2>
                    6. Years of experience in reality capture / scanning <span className="req">*</span>
                  </h2>
                  <p>How long you have been capturing on site</p>
                </div>
              </div>
              <div className="field">
                <label htmlFor="yearsRealityCapture">Years</label>
                <input
                  id="yearsRealityCapture"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  value={details.yearsRealityCapture ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const n = Number(raw);
                    patchDetails({
                      yearsRealityCapture: raw === '' || !Number.isFinite(n) ? null : Math.round(n),
                    });
                  }}
                  placeholder="e.g. 8"
                />
              </div>
            </section>

            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <LordIcon name="consult" size={22} trigger="in" />
                </span>
                <div>
                  <h2>7. Industries served</h2>
                  <p>Sectors you know well</p>
                </div>
              </div>
              <div className="svy-opts">
                {INDUSTRIES_SERVED.map((industry) => {
                  const selected = details.industries.includes(industry);
                  return (
                    <button
                      key={industry}
                      type="button"
                      className={`svy-opt${selected ? ' is-on' : ''}`}
                      aria-pressed={selected}
                      onClick={() =>
                        patchDetails({
                          industries: toggleInList(details.industries, industry as IndustryServed),
                        })
                      }
                    >
                      <span className="svy-opt-mark" aria-hidden>
                        {selected ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span>{INDUSTRY_LABELS[industry]}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="svy-panel svy-panel-span">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <LordIcon name="security" size={22} trigger="in" />
                </span>
                <div>
                  <h2>
                    8. General liability insurance <span className="req">*</span>
                  </h2>
                  <p>Required for matching on commercial work</p>
                </div>
              </div>
              <div className="svy-opts svy-opts-geo">
                {([
                  [true, 'Yes'],
                  [false, 'No'],
                ] as const).map(([value, label]) => {
                  const on = details.generalLiabilityInsurance === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`svy-opt${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => patchDetails({ generalLiabilityInsurance: value })}
                    >
                      <span className="svy-opt-mark" aria-hidden>
                        {on ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
          </motion.div>
        </AnimatePresence>

        <footer className="svy-profile-foot">
          <label className={`svy-matchable${!liveCompletion.complete ? ' is-locked' : ''}`}>
            <span className="svy-matchable-ico" aria-hidden>
              {liveCompletion.complete ? (
                <LordIcon name="check" size={22} trigger="loop-on-hover" />
              ) : (
                <LordIcon name="tools" size={22} trigger="loop-on-hover" />
              )}
            </span>
            <span className="svy-matchable-copy">
              <strong>Available for new matches</strong>
              <span>
                {liveCompletion.complete
                  ? 'Stay visible so our team can send you fitted projects.'
                  : 'Unlocks automatically once your portfolio hits 100%.'}
              </span>
            </span>
            <span className="svy-switch">
              <input
                type="checkbox"
                checked={isMatchable && liveCompletion.complete}
                onChange={(e) => setIsMatchable(e.target.checked)}
                disabled={!liveCompletion.complete}
              />
              <span className="svy-switch-ui" aria-hidden />
            </span>
          </label>

          <div className="svy-foot-nav">
            {step > 0 ? (
              <button
                type="button"
                className="btn secondary svy-foot-back"
                onClick={() => goToStep(step - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : null}
            {!isLastStep ? (
              <button
                type="button"
                className={`btn svy-save${services.length > 0 ? ' is-pulse' : ''}`}
                disabled={figureMood === 'running'}
                onClick={() => goToStep(step + 1)}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn svy-save" type="submit" disabled={!canSubmit}>
                {busy ? <span className="spin" /> : <LordIcon name="briefcase" size={20} trigger="in" />}
                {busy ? 'Saving…' : mode === 'edit' ? 'Save portfolio' : 'Create portfolio'}
              </button>
            )}
          </div>
        </footer>
      </form>

      <IncompleteProfileModal
        percent={liveCompletion.percent}
        open={showIncompleteModal}
        onClose={dismissIncompleteModal}
        onGoToProfile={continueIncompletePortfolio}
      />
    </div>
  );
}
