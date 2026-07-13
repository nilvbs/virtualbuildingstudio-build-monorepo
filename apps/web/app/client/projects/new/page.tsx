'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import { SURVEY_SERVICES, SURVEY_SERVICE_LABELS, type SurveyService } from '@surveylink/types';
import type { CreateProjectBody } from '@surveylink/api-client';
import { api, errorMessage } from '../../../../lib/api';

const BUILDING_TYPES = ['Residential', 'Commercial', 'Industrial', 'Mixed-use', 'Institutional', 'Other'];
const TIMELINES: Array<{ value: string; label: string }> = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '2_weeks', label: 'Within 2 weeks' },
  { value: '1_month', label: 'Within a month' },
  { value: 'flexible', label: 'Flexible' },
];

export default function NewProjectPage() {
  const router = useRouter();
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

  const canSubmit = useMemo(
    () => title.trim().length > 0 && services.length > 0 && !busy,
    [title, services, busy],
  );

  function toggleService(s: SurveyService) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}
      >
        <ArrowLeft size={15} /> Your projects
      </Link>

      <div className="page-head">
        <div>
          <p className="kicker">Client</p>
          <h1 className="page-title">Post a project</h1>
          <p className="page-sub">Tell us what you need surveyed and where — we handle the matching.</p>
        </div>
      </div>

      <form className="card card-pad-lg" onSubmit={onSubmit} noValidate style={{ maxWidth: 680 }}>
        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label htmlFor="title">Project title</label>
          <input
            id="title"
            type="text"
            required
            placeholder="Warehouse scan, Dallas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Services needed</label>
          <span className="hint">Select at least one.</span>
          <div className="checkbox-grid" style={{ marginTop: 6 }}>
            {SURVEY_SERVICES.map((s) => (
              <label key={s} className={`check ${services.includes(s) ? 'selected' : ''}`}>
                <input type="checkbox" checked={services.includes(s)} onChange={() => toggleService(s)} />
                {SURVEY_SERVICE_LABELS[s]}
              </label>
            ))}
          </div>
        </div>

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
            <input id="lat" type="number" step="any" placeholder="32.7767" value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lng">Longitude</label>
            <input id="lng" type="number" step="any" placeholder="-96.7970" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn secondary sm" onClick={useMyLocation} style={{ marginBottom: 18 }}>
          <LocateFixed size={15} /> Use my current location
        </button>

        <div className="row">
          <div className="field">
            <label htmlFor="buildingType">Building type</label>
            <select id="buildingType" value={buildingType} onChange={(e) => setBuildingType(e.target.value)}>
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
            <input id="buildingAge" type="text" placeholder="e.g. 1990s, pre-1950" value={buildingAge} onChange={(e) => setBuildingAge(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="floors">Number of floors</label>
            <input id="floors" type="number" min={0} value={floors} onChange={(e) => setFloors(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="area">Area (sq ft)</label>
            <input id="area" type="number" min={0} value={areaSqft} onChange={(e) => setAreaSqft(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="timeline">Needed within</label>
          <select id="timeline" value={neededWithin} onChange={(e) => setNeededWithin(e.target.value)}>
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
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access details, deliverable format, anything else we should know." />
        </div>

        <button className="btn block" type="submit" disabled={!canSubmit}>
          {busy ? <span className="spin" /> : null}
          {busy ? 'Posting…' : 'Post project'}
        </button>
      </form>
    </>
  );
}
