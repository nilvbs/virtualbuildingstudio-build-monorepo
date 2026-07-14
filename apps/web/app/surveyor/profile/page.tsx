'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Check,
  CircleDollarSign,
  HardHat,
  LocateFixed,
  MapPin,
  Radar,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  SURVEY_SERVICES,
  SURVEY_SERVICE_LABELS,
  SURVEYOR_PROFILE_COMPLETION_CHECKS,
  surveyorProfileCompletion,
  type SurveyService,
} from '@surveylink/types';
import type { SurveyorProfileBody } from '@surveylink/api-client';
import { api, ApiError, errorMessage } from '../../../lib/api';

function CompletionRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="svy-ring" aria-hidden={false} role="img" aria-label={`Profile ${clamped}% complete`}>
      <svg viewBox="0 0 108 108" className="svy-ring-svg">
        <circle className="svy-ring-track" cx="54" cy="54" r={r} />
        <circle
          className="svy-ring-fill"
          cx="54"
          cy="54"
          r={r}
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

  const liveCompletion = useMemo(() => {
    const equipmentList = equipment
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const dayRateCents = dayRate.trim() ? Math.round(parseFloat(dayRate) * 100) : null;
    const location =
      lat.trim() && lng.trim() ? { lat: Number(lat), lng: Number(lng) } : null;
    return surveyorProfileCompletion({
      services,
      equipment: equipmentList,
      bio,
      baseCity,
      location,
      dayRateCents,
    });
  }, [services, equipment, bio, baseCity, lat, lng, dayRate]);

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
      isMatchable: liveCompletion.complete ? isMatchable : false,
    };
    if (dayRate.trim()) body.dayRateCents = Math.round(parseFloat(dayRate) * 100);
    if (lat.trim() && lng.trim()) body.location = { lat: Number(lat), lng: Number(lng) };

    try {
      if (mode === 'edit') await api.updateSurveyorProfile(body);
      else await api.createSurveyorProfile(body);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('bld.surveyor.profilePromptSnoozed');
        window.dispatchEvent(new Event('bld:surveyor-profile-saved'));
      }
      router.push(liveCompletion.complete ? '/surveyor' : '/surveyor/profile');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
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
      <header className="svy-profile-hero">
        <div className="svy-profile-hero-copy">
          <p className="svy-profile-kicker">Expert workspace</p>
          <h1 className="svy-profile-title">
            {mode === 'edit' ? 'Shape your expert profile' : 'Build your expert profile'}
          </h1>
          <p className="svy-profile-lede">
            {liveCompletion.complete
              ? 'Profile complete — Dashboard is unlocked and matching can use your coverage.'
              : 'Complete each section below. Dashboard unlocks at 100%.'}
          </p>

          <div className="svy-profile-steps" aria-label="Completion checklist">
            {SURVEYOR_PROFILE_COMPLETION_CHECKS.map((item) => {
              const done = liveCompletion.done.includes(item.key);
              return (
                <span
                  key={item.key}
                  className={`svy-profile-step${done ? ' is-done' : ''}`}
                >
                  {done ? <Check size={13} strokeWidth={2.6} /> : null}
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>

        <CompletionRing percent={liveCompletion.percent} />
      </header>

      <form className="svy-profile-form" onSubmit={onSubmit} noValidate>
        {error && <div className="alert error">{error}</div>}

        <div className="svy-profile-grid">
          <section className="svy-panel">
            <div className="svy-panel-head">
              <span className="svy-panel-ico" aria-hidden>
                <Briefcase size={18} />
              </span>
              <div>
                <h2>Services</h2>
                <p>What you offer on site</p>
              </div>
            </div>
            <div className="svy-service-grid">
              {SURVEY_SERVICES.map((s) => {
                const selected = services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`svy-service${selected ? ' is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleService(s)}
                  >
                    <span className="svy-service-check" aria-hidden>
                      {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                    </span>
                    <span>{SURVEY_SERVICE_LABELS[s]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="svy-panel">
            <div className="svy-panel-head">
              <span className="svy-panel-ico" aria-hidden>
                <MapPin size={18} />
              </span>
              <div>
                <h2>Coverage</h2>
                <p>Where you work from</p>
              </div>
            </div>

            <div className="svy-fields">
              <div className="field">
                <label htmlFor="baseCity">Base city</label>
                <input
                  id="baseCity"
                  type="text"
                  placeholder="Austin, TX"
                  value={baseCity}
                  onChange={(e) => setBaseCity(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="radius">Coverage radius (km)</label>
                <input
                  id="radius"
                  type="number"
                  min={1}
                  max={1000}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="lat">Latitude</label>
                <input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="30.2672"
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
                  placeholder="-97.7431"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
            </div>

            <button type="button" className="btn secondary sm svy-locate" onClick={useMyLocation}>
              <LocateFixed size={15} /> Use my current location
            </button>
          </section>

          <section className="svy-panel">
            <div className="svy-panel-head">
              <span className="svy-panel-ico" aria-hidden>
                <CircleDollarSign size={18} />
              </span>
              <div>
                <h2>Day rate</h2>
                <p>Typical full-day fee</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="dayRate">Amount (USD)</label>
              <div className="svy-money">
                <span aria-hidden>$</span>
                <input
                  id="dayRate"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="1200"
                  value={dayRate}
                  onChange={(e) => setDayRate(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="svy-panel">
            <div className="svy-panel-head">
              <span className="svy-panel-ico" aria-hidden>
                <Wrench size={18} />
              </span>
              <div>
                <h2>Kit &amp; story</h2>
                <p>Equipment and how you work</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="equipment">Equipment</label>
              <input
                id="equipment"
                type="text"
                placeholder="Leica RTC360, DJI Mavic 3E"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              />
              <span className="hint">Comma-separated list.</span>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                rows={5}
                placeholder="Years on site, specialties, the kinds of buildings you know well…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </section>
        </div>

        <footer className="svy-profile-foot">
          <label className={`svy-matchable${!liveCompletion.complete ? ' is-locked' : ''}`}>
            <span className="svy-matchable-ico" aria-hidden>
              {liveCompletion.complete ? <Radar size={18} /> : <HardHat size={18} />}
            </span>
            <span className="svy-matchable-copy">
              <strong>Available for new matches</strong>
              <span>
                {liveCompletion.complete
                  ? 'Stay visible so our team can send you fitted projects.'
                  : 'Unlocks automatically once your profile hits 100%.'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={isMatchable && liveCompletion.complete}
              onChange={(e) => setIsMatchable(e.target.checked)}
              disabled={!liveCompletion.complete}
            />
          </label>

          <button className="btn svy-save" type="submit" disabled={!canSubmit}>
            {busy ? <span className="spin" /> : <UserRound size={17} />}
            {busy ? 'Saving…' : mode === 'edit' ? 'Save profile' : 'Create profile'}
          </button>
        </footer>
      </form>
    </div>
  );
}
