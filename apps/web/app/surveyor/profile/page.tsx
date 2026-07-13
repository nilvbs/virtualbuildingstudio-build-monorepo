'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LocateFixed } from 'lucide-react';
import { SURVEY_SERVICES, SURVEY_SERVICE_LABELS, type SurveyService } from '@surveylink/types';
import type { SurveyorProfileBody } from '@surveylink/api-client';
import { api, ApiError, errorMessage } from '../../../lib/api';

export default function SurveyorProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [services, setServices] = useState<SurveyService[]>([]);
  const [equipment, setEquipment] = useState('');
  const [bio, setBio] = useState('');
  const [baseCity, setBaseCity] = useState('');
  const [radiusKm, setRadiusKm] = useState('25');
  const [dayRate, setDayRate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isMatchable, setIsMatchable] = useState(true);

  useEffect(() => {
    api
      .getSurveyorProfile()
      .then((p) => {
        setMode('edit');
        setServices(p.services);
        setEquipment(p.equipment.join(', '));
        setBio(p.bio ?? '');
        setBaseCity(p.baseCity ?? '');
        setRadiusKm(String(p.radiusKm));
        setDayRate(p.dayRateCents != null ? String(p.dayRateCents / 100) : '');
        setLat(p.location ? String(p.location.lat) : '');
        setLng(p.location ? String(p.location.lng) : '');
        setIsMatchable(p.isMatchable);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setMode('create');
        else if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  const canSubmit = useMemo(() => services.length > 0 && !busy, [services, busy]);

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

    const body: SurveyorProfileBody = {
      services,
      equipment: equipment
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      bio: bio.trim() || undefined,
      baseCity: baseCity.trim() || undefined,
      radiusKm: Number(radiusKm) || 25,
      isMatchable,
    };
    if (dayRate.trim()) body.dayRateCents = Math.round(parseFloat(dayRate) * 100);
    if (lat.trim() && lng.trim()) body.location = { lat: Number(lat), lng: Number(lng) };

    try {
      if (mode === 'edit') await api.updateSurveyorProfile(body);
      else await api.createSurveyorProfile(body);
      router.push('/surveyor');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="skeleton sk-line" style={{ width: 220, height: 22 }} />
        <div className="card" style={{ marginTop: 20, height: 300 }} />
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Surveyor</p>
          <h1 className="page-title">{mode === 'edit' ? 'Edit your profile' : 'Set up your profile'}</h1>
          <p className="page-sub">This is what our team uses to match you to the right projects.</p>
        </div>
      </div>

      <form className="card card-pad-lg" onSubmit={onSubmit} noValidate style={{ maxWidth: 680 }}>
        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label>Services offered</label>
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

        <div className="row">
          <div className="field">
            <label htmlFor="baseCity">Base city</label>
            <input id="baseCity" type="text" placeholder="Austin, TX" value={baseCity} onChange={(e) => setBaseCity(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="radius">Coverage radius (km)</label>
            <input id="radius" type="number" min={1} max={1000} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="lat">Base latitude</label>
            <input id="lat" type="number" step="any" placeholder="30.2672" value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lng">Base longitude</label>
            <input id="lng" type="number" step="any" placeholder="-97.7431" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn secondary sm" onClick={useMyLocation} style={{ marginBottom: 18 }}>
          <LocateFixed size={15} /> Use my current location
        </button>

        <div className="field">
          <label htmlFor="dayRate">Day rate (USD)</label>
          <input id="dayRate" type="number" min={0} step="1" placeholder="1200" value={dayRate} onChange={(e) => setDayRate(e.target.value)} />
          <span className="hint">Stored as integer cents on the server.</span>
        </div>

        <div className="field">
          <label htmlFor="equipment">Equipment</label>
          <input id="equipment" type="text" placeholder="Leica RTC360, DJI Mavic 3E" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
          <span className="hint">Comma-separated.</span>
        </div>

        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        <label className="check" style={{ marginBottom: 20, width: 'fit-content' }}>
          <input type="checkbox" checked={isMatchable} onChange={(e) => setIsMatchable(e.target.checked)} />
          Available to be matched to new projects
        </label>

        <button className="btn block" type="submit" disabled={!canSubmit}>
          {busy ? <span className="spin" /> : null}
          {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create profile'}
        </button>

        <p className="hint" style={{ marginTop: 16 }}>
          Portfolio image uploads arrive with object storage in a later step.
        </p>
      </form>
    </>
  );
}
