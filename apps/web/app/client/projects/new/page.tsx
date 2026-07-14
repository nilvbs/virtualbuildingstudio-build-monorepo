'use client';

import { useMemo, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, LocateFixed } from 'lucide-react';
import { SURVEY_SERVICES, SURVEY_SERVICE_LABELS, type SurveyService } from '@surveylink/types';
import type { CreateProjectBody } from '@surveylink/api-client';
import { api, errorMessage } from '../../../../lib/api';
import { reverseGeocode } from '../../../../lib/geocode';

const LocationMapPicker = dynamic(
  () => import('../../../../components/location-map-picker').then((m) => m.LocationMapPicker),
  {
    ssr: false,
    loading: () => <div className="location-map location-map--loading">Loading map…</div>,
  },
);

const LocationPlaceSearch = dynamic(
  () => import('../../../../components/location-place-search').then((m) => m.LocationPlaceSearch),
  { ssr: false },
);

const BUILDING_TYPES = ['Residential', 'Commercial', 'Industrial', 'Mixed-use', 'Institutional', 'Other'];
const TIMELINES: Array<{ value: string; label: string }> = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '2_weeks', label: 'Within 2 weeks' },
  { value: '1_month', label: 'Within a month' },
  { value: 'flexible', label: 'Flexible' },
];

const STEPS = [
  { id: 'basics', label: 'Basics', blurb: 'Title and services' },
  { id: 'location', label: 'Location', blurb: 'Where is the site?' },
  { id: 'building', label: 'Building', blurb: 'Site details' },
  { id: 'finish', label: 'Finish', blurb: 'Timing and notes' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [services, setServices] = useState<SurveyService[]>([]);
  const [locationText, setLocationText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [buildingAge, setBuildingAge] = useState('');
  const [floors, setFloors] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [neededWithin, setNeededWithin] = useState('');
  const [notes, setNotes] = useState('');
  const [locating, setLocating] = useState(false);

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const stepValid = useMemo(() => {
    if (current.id === 'basics') return title.trim().length > 0 && services.length > 0;
    return true;
  }, [current.id, title, services]);

  function toggleService(s: SurveyService) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }

    setError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setLat(nextLat.toFixed(6));
        setLng(nextLng.toFixed(6));

        try {
          const address = await reverseGeocode(nextLat, nextLng);
          if (address) setLocationText(address);
        } catch {
          // Coordinates are still set; address is best-effort.
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.message || 'Could not read your current location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function goNext() {
    setError(null);
    if (!stepValid) {
      setError('Add a project title and select at least one service to continue.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  /** Enter / form submit must never auto-post. Only the Post button creates the project. */
  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLast) goNext();
  }

  async function postProject() {
    if (!isLast || !stepValid || busy) return;

    setError(null);
    setBusy(true);

    const body: CreateProjectBody = { title: title.trim(), services };
    if (locationText.trim()) body.locationText = locationText.trim();
    if (lat.trim() && lng.trim()) body.location = { lat: Number(lat), lng: Number(lng) };
    if (buildingType) body.buildingType = buildingType;
    if (buildingAge.trim()) body.buildingAge = buildingAge.trim();
    if (floors.trim()) body.floors = Number(floors);
    if (areaSqft.trim()) body.areaSqft = Number(areaSqft);
    if (neededWithin) body.neededWithin = neededWithin;
    if (notes.trim()) body.notes = notes.trim();

    try {
      const project = await api.createProject(body);
      router.push(`/client/projects/${project.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        href="/client"
        className="plain"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--muted)',
          fontSize: 13.5,
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={15} /> Your projects
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">Post a project</h1>
          <p className="page-sub">A short guided flow — we&apos;ll match you to a vetted surveyor.</p>
        </div>
      </div>

      <ol className="wizard-steps" aria-label="Project steps">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.id} className={`wizard-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}>
              <span className="wizard-step-index" aria-hidden>
                {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="wizard-step-copy">
                <strong>{s.label}</strong>
                <span>{s.blurb}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <form className="card card-pad-lg wizard-card" onSubmit={onFormSubmit} noValidate>
        {current.id !== 'location' ? (
          <div className="wizard-panel-head">
            <p className="kicker">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="wizard-panel-title">{current.label}</h2>
            <p className="page-sub" style={{ margin: 0 }}>
              {current.blurb}
            </p>
          </div>
        ) : null}

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}

        {current.id === 'basics' && (
          <div className="wizard-panel" key="basics">
            <div className="field">
              <label htmlFor="title">Project title</label>
              <input
                id="title"
                type="text"
                required
                placeholder="Warehouse scan, Dallas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="field">
              <label>Services needed</label>
              <span className="hint">Select at least one.</span>
              <div className="checkbox-grid" style={{ marginTop: 6 }}>
                {SURVEY_SERVICES.map((s) => (
                  <label key={s} className={`check ${services.includes(s) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={services.includes(s)}
                      onChange={() => toggleService(s)}
                    />
                    {SURVEY_SERVICE_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {current.id === 'location' && (
          <div className="wizard-panel wizard-panel--location" key="location">
            <div className="location-split">
              <div className="location-split-fields">
                <div className="wizard-panel-head wizard-panel-head--inline">
                  <p className="kicker">
                    Step {step + 1} of {STEPS.length}
                  </p>
                  <h2 className="wizard-panel-title">{current.label}</h2>
                  <p className="page-sub" style={{ margin: 0 }}>
                    {current.blurb}
                  </p>
                </div>

                <LocationPlaceSearch
                  onSelect={(nextLat, nextLng, label) => {
                    setLat(nextLat.toFixed(6));
                    setLng(nextLng.toFixed(6));
                    setLocationText(label);
                  }}
                />

                <div className="field">
                  <label htmlFor="locationText">Site address / description</label>
                  <input
                    id="locationText"
                    type="text"
                    placeholder="123 Main St, Dallas, TX"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                  />
                </div>

                <div className="row">
                  <div className="field">
                    <label htmlFor="lat">Latitude</label>
                    <input
                      id="lat"
                      type="number"
                      step="any"
                      placeholder="32.7767"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="lng">Longitude</label>
                    <input
                      id="lng"
                      type="number"
                      step="any"
                      placeholder="-96.7970"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                    />
                  </div>
                </div>

                <button type="button" className="btn secondary sm" onClick={useMyLocation} disabled={locating}>
                  <LocateFixed size={15} /> {locating ? 'Finding location…' : 'Use my current location'}
                </button>
                <p className="hint" style={{ marginTop: 10 }}>
                  Optional — search a place, click the map, or enter coordinates.
                </p>
              </div>

              <div className="location-split-map">
                <LocationMapPicker
                  lat={lat}
                  lng={lng}
                  label={locationText.trim() || null}
                  onPick={async (nextLat, nextLng) => {
                    setLat(nextLat.toFixed(6));
                    setLng(nextLng.toFixed(6));
                    try {
                      const address = await reverseGeocode(nextLat, nextLng);
                      if (address) setLocationText(address);
                    } catch {
                      // Keep pin even if reverse geocode fails.
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {current.id === 'building' && (
          <div className="wizard-panel" key="building">
            <div className="row">
              <div className="field">
                <label htmlFor="buildingType">Building type</label>
                <select
                  id="buildingType"
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                >
                  <option value="">Select…</option>
                  {BUILDING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="buildingAge">Building age</label>
                <input
                  id="buildingAge"
                  type="text"
                  placeholder="e.g. 1990s, pre-1950"
                  value={buildingAge}
                  onChange={(e) => setBuildingAge(e.target.value)}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="floors">Number of floors</label>
                <input
                  id="floors"
                  type="number"
                  min={0}
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="area">Area (sq ft)</label>
                <input
                  id="area"
                  type="number"
                  min={0}
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {current.id === 'finish' && (
          <div className="wizard-panel" key="finish">
            <div className="field">
              <label htmlFor="timeline">Needed within</label>
              <select
                id="timeline"
                value={neededWithin}
                onChange={(e) => setNeededWithin(e.target.value)}
              >
                <option value="">Select…</option>
                {TIMELINES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Access details, deliverable format, anything else we should know."
              />
            </div>

            <div className="wizard-summary">
              <strong>{title.trim() || 'Untitled project'}</strong>
              <span>
                {services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ') || 'No services selected'}
              </span>
              {locationText.trim() ? <span>{locationText.trim()}</span> : null}
            </div>
          </div>
        )}

        <div className="wizard-actions">
          <button type="button" className="btn secondary" onClick={goBack} disabled={step === 0 || busy}>
            <ArrowLeft size={16} /> Back
          </button>
          {isLast ? (
            <button className="btn" type="button" onClick={postProject} disabled={!stepValid || busy}>
              {busy ? <span className="spin" /> : null}
              {busy ? 'Posting…' : 'Post project'}
            </button>
          ) : (
            <button className="btn" type="button" onClick={goNext} disabled={!stepValid}>
              Continue <ArrowRight size={16} />
            </button>
          )}
        </div>
      </form>
    </>
  );
}
