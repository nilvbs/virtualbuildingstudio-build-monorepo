'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Building2,
  Check,
  CircleDollarSign,
  FileText,
  Globe2,
  HardHat,
  Languages,
  LocateFixed,
  MapPin,
  Radar,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
  COMPANY_CERTIFICATION_LABELS,
  COMPANY_CERTIFICATIONS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  EQUIPMENT_GROUPS,
  EQUIPMENT_LABELS,
  INDUSTRIES_SERVED,
  INDUSTRY_LABELS,
  PORTFOLIO_LANGUAGE_LABELS,
  PORTFOLIO_LANGUAGES,
  PROFESSIONAL_MEMBERSHIP_LABELS,
  PROFESSIONAL_MEMBERSHIPS,
  SURVEY_SERVICE_GROUPS,
  SURVEY_SERVICE_LABELS,
  SURVEYOR_PROFILE_COMPLETION_CHECKS,
  emptyPortfolioDetails,
  newEntryId,
  normalizePortfolioDetails,
  surveyorProfileCompletion,
  type AccountType,
  type AvailabilityOption,
  type CompanyIdentity,
  type EquipmentId,
  type IndividualIdentity,
  type IndustryServed,
  type PortfolioLanguage,
  type PortfolioProject,
  type SurveyService,
  type SurveyorPortfolioDetails,
  type TravelChargeOption,
} from '@surveylink/types';
import type { SurveyorProfileBody } from '@surveylink/api-client';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { S3MediaField } from '../../../components/s3-media-field';

function CompletionRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="svy-ring" role="img" aria-label={`Portfolio ${clamped}% complete`}>
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

type TabId = 'core' | 'identity';

export default function SurveyorProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>('core');
  const [accountType, setAccountType] = useState<AccountType>('individual');

  const [services, setServices] = useState<SurveyService[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [baseCity, setBaseCity] = useState('');
  const [radiusKm, setRadiusKm] = useState('250');
  const [dayRate, setDayRate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isMatchable, setIsMatchable] = useState(true);
  const [details, setDetails] = useState<SurveyorPortfolioDetails>(emptyPortfolioDetails());

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
        setBaseCity(profile.baseCity ?? '');
        setRadiusKm(String(profile.radiusKm));
        setDayRate(dollarsFromCents(profile.dayRateCents));
        setLat(profile.location ? String(profile.location.lat) : '');
        setLng(profile.location ? String(profile.location.lng) : '');
        setIsMatchable(profile.isMatchable);
        const nextDetails = normalizePortfolioDetails(profile.details, type);
        if (!nextDetails.identity || nextDetails.identity.kind !== type) {
          nextDetails.identity = emptyPortfolioDetails(type).identity;
        }
        setDetails(nextDetails);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

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

  const canSubmit = services.length > 0 && !busy;

  function patchDetails(patch: Partial<SurveyorPortfolioDetails>) {
    setDetails((current) => ({ ...current, ...patch }));
  }

  function patchIndividual(patch: Partial<IndividualIdentity>) {
    setDetails((current) => {
      const identity =
        current.identity?.kind === 'individual'
          ? current.identity
          : (emptyPortfolioDetails('individual').identity as IndividualIdentity);
      return { ...current, identity: { ...identity, ...patch, kind: 'individual' } };
    });
  }

  function patchCompany(patch: Partial<CompanyIdentity>) {
    setDetails((current) => {
      const identity =
        current.identity?.kind === 'company'
          ? current.identity
          : (emptyPortfolioDetails('company').identity as CompanyIdentity);
      return { ...current, identity: { ...identity, ...patch, kind: 'company' } };
    });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }

  function addProject() {
    const project: PortfolioProject = {
      id: newEntryId(),
      title: '',
      clientIndustry: '',
      location: '',
      buildingType: '',
      projectSize: '',
      completionYear: '',
      servicesProvided: [],
      images: [],
      description: '',
      deliverables: '',
    };
    patchDetails({ projects: [...details.projects, project] });
  }

  function addCertification() {
    patchDetails({
      certifications: [
        ...details.certifications,
        {
          id: newEntryId(),
          name: '',
          issuingOrganization: '',
          certificateNumber: '',
          expiryDate: null,
          fileKey: null,
        },
      ],
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const identity = details.identity;
    const bio =
      identity?.kind === 'individual'
        ? identity.aboutMe.trim() || identity.headline.trim()
        : identity?.kind === 'company'
          ? identity.aboutCompany.trim() || identity.tagline.trim()
          : '';

    const body: SurveyorProfileBody = {
      services,
      equipment,
      bio: bio || undefined,
      baseCity: baseCity.trim() || undefined,
      radiusKm: Number(radiusKm) || 25,
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

  const individual =
    details.identity?.kind === 'individual' ? details.identity : null;
  const company = details.identity?.kind === 'company' ? details.identity : null;

  return (
    <div className="svy-profile">
      <header className="svy-profile-hero">
        <div className="svy-profile-hero-copy">
          <p className="svy-profile-kicker">Expert workspace</p>
          <h1 className="svy-profile-title">
            {mode === 'edit' ? 'Shape your expert portfolio' : 'Build your expert portfolio'}
          </h1>
          <p className="svy-profile-lede">
            Core information is shared by everyone. Identity fields adapt for{' '}
            {accountType === 'company' ? 'company' : 'individual'} accounts.
          </p>
          <div className="svy-profile-steps" aria-label="Completion checklist">
            {SURVEYOR_PROFILE_COMPLETION_CHECKS.map((item) => {
              const done = liveCompletion.done.includes(item.key);
              return (
                <span key={item.key} className={`svy-profile-step${done ? ' is-done' : ''}`}>
                  {done ? <Check size={13} strokeWidth={2.6} /> : null}
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>
        <CompletionRing percent={liveCompletion.percent} />
      </header>

      <div className="svy-tabs" role="tablist" aria-label="Portfolio sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'core'}
          className={`svy-tab${tab === 'core' ? ' is-active' : ''}`}
          onClick={() => setTab('core')}
        >
          Core information
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'identity'}
          className={`svy-tab${tab === 'identity' ? ' is-active' : ''}`}
          onClick={() => setTab('identity')}
        >
          {accountType === 'company' ? 'Company profile' : 'Professional profile'}
        </button>
      </div>

      <form className="svy-profile-form" onSubmit={onSubmit} noValidate>
        {error && <div className="alert error">{error}</div>}

        {tab === 'core' ? (
          <div className="svy-profile-grid svy-profile-grid-wide">
            <section className="svy-panel svy-panel-span">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <Briefcase size={18} />
                </span>
                <div>
                  <h2>1. Services offered</h2>
                  <p>Multi-select by category</p>
                </div>
              </div>
              {SURVEY_SERVICE_GROUPS.map((group) => (
                <div key={group.id} className="svy-group">
                  <h3 className="svy-group-title">{group.label}</h3>
                  <div className="svy-service-grid">
                    {group.services.map((s) => {
                      const selected = services.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`svy-service${selected ? ' is-selected' : ''}`}
                          aria-pressed={selected}
                          onClick={() => setServices((prev) => toggleInList(prev, s))}
                        >
                          <span className="svy-service-check">
                            {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                          </span>
                          <span>{SURVEY_SERVICE_LABELS[s]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <MapPin size={18} />
                </span>
                <div>
                  <h2>2. Service coverage</h2>
                  <p>Where you can take work</p>
                </div>
              </div>
              <div className="svy-fields">
                <div className="field">
                  <label htmlFor="baseCity">Base location</label>
                  <input
                    id="baseCity"
                    value={baseCity}
                    onChange={(e) => setBaseCity(e.target.value)}
                    placeholder="Houston, Texas"
                  />
                </div>
                <div className="field">
                  <label htmlFor="radius">Coverage radius (km)</label>
                  <input
                    id="radius"
                    type="number"
                    min={1}
                    max={10000}
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
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                </div>
              </div>
              <button type="button" className="btn secondary sm svy-locate" onClick={useMyLocation}>
                <LocateFixed size={15} /> Use my current location
              </button>
              <div className="svy-toggle-row">
                <label>
                  <input
                    type="checkbox"
                    checked={details.travelNationwide}
                    onChange={(e) => patchDetails({ travelNationwide: e.target.checked })}
                  />
                  Travel nationwide
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={details.internationalProjects}
                    onChange={(e) => patchDetails({ internationalProjects: e.target.checked })}
                  />
                  International projects
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={details.remoteServices}
                    onChange={(e) => patchDetails({ remoteServices: e.target.checked })}
                  />
                  Remote services available
                </label>
              </div>
            </section>

            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <Radar size={18} />
                </span>
                <div>
                  <h2>3. Availability</h2>
                  <p>How soon you can start</p>
                </div>
              </div>
              <div className="svy-service-grid">
                {AVAILABILITY_OPTIONS.map((option) => {
                  const selected = details.availability === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`svy-service${selected ? ' is-selected' : ''}`}
                      onClick={() =>
                        patchDetails({ availability: option as AvailabilityOption })
                      }
                    >
                      <span className="svy-service-check">
                        {selected ? <Check size={14} strokeWidth={2.6} /> : null}
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
            </section>

            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <CircleDollarSign size={18} />
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
                <div className="field">
                  <label htmlFor="emergency">Emergency rate (/day)</label>
                  <div className="svy-money">
                    <span>$</span>
                    <input
                      id="emergency"
                      type="number"
                      min={0}
                      value={dollarsFromCents(details.emergencyRateCents)}
                      onChange={(e) =>
                        patchDetails({
                          emergencyRateCents: centsFromDollars(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Travel charges</label>
                  <div className="svy-toggle-row">
                    {(['included', 'extra'] as TravelChargeOption[]).map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="travelCharges"
                          checked={details.travelCharges === option}
                          onChange={() => patchDetails({ travelCharges: option })}
                        />
                        {option === 'included' ? 'Included' : 'Extra'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="svy-panel svy-panel-span">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <Wrench size={18} />
                </span>
                <div>
                  <h2>5. Equipment</h2>
                  <p>Select from catalog</p>
                </div>
              </div>
              {EQUIPMENT_GROUPS.map((group) => (
                <div key={group.id} className="svy-group">
                  <h3 className="svy-group-title">{group.label}</h3>
                  <div className="svy-service-grid">
                    {group.items.map((id) => {
                      const selected = equipment.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`svy-service${selected ? ' is-selected' : ''}`}
                          onClick={() => setEquipment((prev) => toggleInList(prev, id))}
                        >
                          <span className="svy-service-check">
                            {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                          </span>
                          <span>{EQUIPMENT_LABELS[id as EquipmentId]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            <section className="svy-panel svy-panel-span">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <FileText size={18} />
                </span>
                <div>
                  <h2>6. Certifications</h2>
                  <p>Name, issuer, number, expiry</p>
                </div>
              </div>
              <div className="svy-stack">
                {details.certifications.map((cert, index) => (
                  <div key={cert.id} className="svy-repeat-card">
                    <div className="svy-fields">
                      <div className="field">
                        <label>Certificate name</label>
                        <input
                          value={cert.name}
                          onChange={(e) => {
                            const next = [...details.certifications];
                            next[index] = { ...cert, name: e.target.value };
                            patchDetails({ certifications: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Issuing organization</label>
                        <input
                          value={cert.issuingOrganization}
                          onChange={(e) => {
                            const next = [...details.certifications];
                            next[index] = { ...cert, issuingOrganization: e.target.value };
                            patchDetails({ certifications: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Certificate number</label>
                        <input
                          value={cert.certificateNumber}
                          onChange={(e) => {
                            const next = [...details.certifications];
                            next[index] = { ...cert, certificateNumber: e.target.value };
                            patchDetails({ certifications: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Expiry date</label>
                        <input
                          type="date"
                          value={cert.expiryDate ?? ''}
                          onChange={(e) => {
                            const next = [...details.certifications];
                            next[index] = { ...cert, expiryDate: e.target.value || null };
                            patchDetails({ certifications: next });
                          }}
                        />
                      </div>
                    </div>
                    <S3MediaField
                      kind="certificate"
                      label="Certificate file (S3)"
                      variant="doc"
                      url={cert.fileKey}
                      fileName={cert.fileKey ? 'Certificate' : null}
                      onUploaded={({ url }) => {
                        const next = [...details.certifications];
                        next[index] = { ...cert, fileKey: url };
                        patchDetails({ certifications: next });
                      }}
                      onCleared={() => {
                        const next = [...details.certifications];
                        next[index] = { ...cert, fileKey: null };
                        patchDetails({ certifications: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() =>
                        patchDetails({
                          certifications: details.certifications.filter((c) => c.id !== cert.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn secondary sm" onClick={addCertification}>
                  Add certification
                </button>
              </div>
            </section>

            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <Languages size={18} />
                </span>
                <div>
                  <h2>7. Languages</h2>
                  <p>Languages you work in</p>
                </div>
              </div>
              <div className="svy-service-grid">
                {PORTFOLIO_LANGUAGES.map((lang) => {
                  const selected = details.languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      className={`svy-service${selected ? ' is-selected' : ''}`}
                      onClick={() =>
                        patchDetails({
                          languages: toggleInList(details.languages, lang as PortfolioLanguage),
                        })
                      }
                    >
                      <span className="svy-service-check">
                        {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                      </span>
                      <span>{PORTFOLIO_LANGUAGE_LABELS[lang]}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="svy-panel">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <Globe2 size={18} />
                </span>
                <div>
                  <h2>8. Industries served</h2>
                  <p>Sectors you know well</p>
                </div>
              </div>
              <div className="svy-service-grid">
                {INDUSTRIES_SERVED.map((industry) => {
                  const selected = details.industries.includes(industry);
                  return (
                    <button
                      key={industry}
                      type="button"
                      className={`svy-service${selected ? ' is-selected' : ''}`}
                      onClick={() =>
                        patchDetails({
                          industries: toggleInList(
                            details.industries,
                            industry as IndustryServed,
                          ),
                        })
                      }
                    >
                      <span className="svy-service-check">
                        {selected ? <Check size={14} strokeWidth={2.6} /> : null}
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
                  <Briefcase size={18} />
                </span>
                <div>
                  <h2>9. Portfolio projects</h2>
                  <p>Case studies clients can review</p>
                </div>
              </div>
              <div className="svy-stack">
                {details.projects.map((project, index) => (
                  <div key={project.id} className="svy-repeat-card">
                    <div className="svy-fields">
                      <div className="field">
                        <label>Project title</label>
                        <input
                          value={project.title}
                          onChange={(e) => {
                            const next = [...details.projects];
                            next[index] = { ...project, title: e.target.value };
                            patchDetails({ projects: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Client industry</label>
                        <input
                          value={project.clientIndustry}
                          onChange={(e) => {
                            const next = [...details.projects];
                            next[index] = { ...project, clientIndustry: e.target.value };
                            patchDetails({ projects: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Location</label>
                        <input
                          value={project.location}
                          onChange={(e) => {
                            const next = [...details.projects];
                            next[index] = { ...project, location: e.target.value };
                            patchDetails({ projects: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Building type</label>
                        <input
                          value={project.buildingType}
                          onChange={(e) => {
                            const next = [...details.projects];
                            next[index] = { ...project, buildingType: e.target.value };
                            patchDetails({ projects: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Project size</label>
                        <input
                          value={project.projectSize}
                          onChange={(e) => {
                            const next = [...details.projects];
                            next[index] = { ...project, projectSize: e.target.value };
                            patchDetails({ projects: next });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Completion year</label>
                        <input
                          value={project.completionYear}
                          onChange={(e) => {
                            const next = [...details.projects];
                            next[index] = { ...project, completionYear: e.target.value };
                            patchDetails({ projects: next });
                          }}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Description</label>
                      <textarea
                        rows={3}
                        value={project.description}
                        onChange={(e) => {
                          const next = [...details.projects];
                          next[index] = { ...project, description: e.target.value };
                          patchDetails({ projects: next });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label>Deliverables</label>
                      <textarea
                        rows={2}
                        value={project.deliverables}
                        onChange={(e) => {
                          const next = [...details.projects];
                          next[index] = { ...project, deliverables: e.target.value };
                          patchDetails({ projects: next });
                        }}
                      />
                    </div>
                    <div className="svy-project-images">
                      <span className="label">Project images (S3)</span>
                      <div className="svy-image-grid">
                        {project.images.map((img, imgIndex) => (
                          <div key={`${img.key}-${imgIndex}`} className="svy-image-tile">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.key} alt={img.caption || project.title || 'Project'} />
                            <button
                              type="button"
                              className="svy-image-remove"
                              onClick={() => {
                                const next = [...details.projects];
                                next[index] = {
                                  ...project,
                                  images: project.images.filter((_, i) => i !== imgIndex),
                                };
                                patchDetails({ projects: next });
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                      <S3MediaField
                        kind="portfolio"
                        label="Add project image"
                        hint="Uploaded to S3 — preview uses the public URL"
                        url={null}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onUploaded={({ url }) => {
                          const next = [...details.projects];
                          next[index] = {
                            ...project,
                            images: [...project.images, { key: url }],
                          };
                          patchDetails({ projects: next });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() =>
                        patchDetails({
                          projects: details.projects.filter((p) => p.id !== project.id),
                        })
                      }
                    >
                      Remove project
                    </button>
                  </div>
                ))}
                <button type="button" className="btn secondary sm" onClick={addProject}>
                  Add project
                </button>
              </div>
            </section>

            <section className="svy-panel svy-panel-span">
              <div className="svy-panel-head">
                <span className="svy-panel-ico">
                  <FileText size={18} />
                </span>
                <div>
                  <h2>10. Documents</h2>
                  <p>Each file uploads to S3 — we store the public URL</p>
                </div>
              </div>
              <div className="svy-doc-grid">
                {DOCUMENT_TYPES.map((type) => {
                  const doc = details.documents.find((d) => d.type === type) ?? {
                    type,
                    fileKey: null,
                    fileName: null,
                  };
                  return (
                    <S3MediaField
                      key={type}
                      kind="document"
                      label={DOCUMENT_TYPE_LABELS[type]}
                      variant="doc"
                      url={doc.fileKey}
                      fileName={doc.fileName}
                      onUploaded={({ url, fileName }) => {
                        const next = DOCUMENT_TYPES.map((t) => {
                          const existing = details.documents.find((d) => d.type === t) ?? {
                            type: t,
                            fileKey: null,
                            fileName: null,
                          };
                          if (t !== type) return existing;
                          return { type: t, fileKey: url, fileName };
                        });
                        patchDetails({ documents: next });
                      }}
                      onCleared={() => {
                        const next = DOCUMENT_TYPES.map((t) => {
                          const existing = details.documents.find((d) => d.type === t) ?? {
                            type: t,
                            fileKey: null,
                            fileName: null,
                          };
                          if (t !== type) return existing;
                          return { type: t, fileKey: null, fileName: null };
                        });
                        patchDetails({ documents: next });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="svy-profile-grid svy-profile-grid-wide">
            {accountType === 'individual' && individual ? (
              <>
                <section className="svy-panel svy-panel-span">
                  <div className="svy-panel-head">
                    <span className="svy-panel-ico">
                      <UserRound size={18} />
                    </span>
                    <div>
                      <h2>Professional profile</h2>
                      <p>Personal information for individual accounts</p>
                    </div>
                  </div>
                  <div className="svy-fields">
                    <div className="field">
                      <label>Professional title</label>
                      <input
                        value={individual.professionalTitle}
                        onChange={(e) => patchIndividual({ professionalTitle: e.target.value })}
                        placeholder="Licensed Land Surveyor"
                      />
                    </div>
                    <div className="field">
                      <label>Headline</label>
                      <input
                        value={individual.headline}
                        onChange={(e) => patchIndividual({ headline: e.target.value })}
                        placeholder="Commercial Survey Specialist with 12 Years Experience"
                      />
                    </div>
                    <div className="field">
                      <label>Years of experience</label>
                      <input
                        type="number"
                        min={0}
                        value={individual.yearsExperience ?? ''}
                        onChange={(e) =>
                          patchIndividual({
                            yearsExperience: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Current company (optional)</label>
                      <input
                        value={individual.currentCompany}
                        onChange={(e) => patchIndividual({ currentCompany: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>About me</label>
                    <textarea
                      rows={6}
                      value={individual.aboutMe}
                      onChange={(e) => patchIndividual({ aboutMe: e.target.value })}
                    />
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Skills</h2>
                      <p>Comma-separated</p>
                    </div>
                  </div>
                  <div className="field">
                    <input
                      value={individual.skills.join(', ')}
                      onChange={(e) =>
                        patchIndividual({
                          skills: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Laser Scanning, Topographic Survey, Civil3D"
                    />
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Professional memberships</h2>
                    </div>
                  </div>
                  <div className="svy-service-grid">
                    {PROFESSIONAL_MEMBERSHIPS.map((m) => {
                      const selected = individual.memberships.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          className={`svy-service${selected ? ' is-selected' : ''}`}
                          onClick={() =>
                            patchIndividual({
                              memberships: toggleInList(individual.memberships, m),
                            })
                          }
                        >
                          <span className="svy-service-check">
                            {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                          </span>
                          <span>{PROFESSIONAL_MEMBERSHIP_LABELS[m]}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Achievements</h2>
                      <p>One per line</p>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={individual.achievements.join('\n')}
                    onChange={(e) =>
                      patchIndividual({
                        achievements: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder={'Top Rated Surveyor\n300+ Projects'}
                  />
                </section>

                <section className="svy-panel svy-panel-span">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Previous experience</h2>
                    </div>
                  </div>
                  <div className="svy-stack">
                    {individual.previousExperience.map((entry, index) => (
                      <div key={entry.id} className="svy-repeat-card">
                        <div className="svy-fields">
                          <div className="field">
                            <label>Company</label>
                            <input
                              value={entry.company}
                              onChange={(e) => {
                                const next = [...individual.previousExperience];
                                next[index] = { ...entry, company: e.target.value };
                                patchIndividual({ previousExperience: next });
                              }}
                            />
                          </div>
                          <div className="field">
                            <label>Designation</label>
                            <input
                              value={entry.designation}
                              onChange={(e) => {
                                const next = [...individual.previousExperience];
                                next[index] = { ...entry, designation: e.target.value };
                                patchIndividual({ previousExperience: next });
                              }}
                            />
                          </div>
                          <div className="field">
                            <label>Duration</label>
                            <input
                              value={entry.duration}
                              onChange={(e) => {
                                const next = [...individual.previousExperience];
                                next[index] = { ...entry, duration: e.target.value };
                                patchIndividual({ previousExperience: next });
                              }}
                              placeholder="2019-Present"
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label>Description</label>
                          <textarea
                            rows={2}
                            value={entry.description}
                            onChange={(e) => {
                              const next = [...individual.previousExperience];
                              next[index] = { ...entry, description: e.target.value };
                              patchIndividual({ previousExperience: next });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() =>
                        patchIndividual({
                          previousExperience: [
                            ...individual.previousExperience,
                            {
                              id: newEntryId(),
                              company: '',
                              designation: '',
                              duration: '',
                              description: '',
                            },
                          ],
                        })
                      }
                    >
                      Add experience
                    </button>
                  </div>
                </section>

                <section className="svy-panel svy-panel-span">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Education</h2>
                    </div>
                  </div>
                  <div className="svy-stack">
                    {individual.education.map((entry, index) => (
                      <div key={entry.id} className="svy-fields svy-repeat-card">
                        <div className="field">
                          <label>Degree</label>
                          <input
                            value={entry.degree}
                            onChange={(e) => {
                              const next = [...individual.education];
                              next[index] = { ...entry, degree: e.target.value };
                              patchIndividual({ education: next });
                            }}
                          />
                        </div>
                        <div className="field">
                          <label>University</label>
                          <input
                            value={entry.university}
                            onChange={(e) => {
                              const next = [...individual.education];
                              next[index] = { ...entry, university: e.target.value };
                              patchIndividual({ education: next });
                            }}
                          />
                        </div>
                        <div className="field">
                          <label>Year</label>
                          <input
                            value={entry.year}
                            onChange={(e) => {
                              const next = [...individual.education];
                              next[index] = { ...entry, year: e.target.value };
                              patchIndividual({ education: next });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() =>
                        patchIndividual({
                          education: [
                            ...individual.education,
                            { id: newEntryId(), degree: '', university: '', year: '' },
                          ],
                        })
                      }
                    >
                      Add education
                    </button>
                  </div>
                </section>
              </>
            ) : null}

            {accountType === 'company' && company ? (
              <>
                <section className="svy-panel svy-panel-span">
                  <div className="svy-panel-head">
                    <span className="svy-panel-ico">
                      <Building2 size={18} />
                    </span>
                    <div>
                      <h2>Company profile</h2>
                      <p>Company information</p>
                    </div>
                  </div>
                  <div className="svy-brand-media">
                    <S3MediaField
                      kind="logo"
                      label="Company logo"
                      hint="Square logo — stored as S3 URL"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      url={company.logoKey}
                      onUploaded={({ url }) => patchCompany({ logoKey: url })}
                      onCleared={() => patchCompany({ logoKey: null })}
                    />
                    <S3MediaField
                      kind="cover"
                      label="Cover image"
                      hint="Wide banner — stored as S3 URL"
                      variant="wide"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      url={company.coverImageKey}
                      onUploaded={({ url }) => patchCompany({ coverImageKey: url })}
                      onCleared={() => patchCompany({ coverImageKey: null })}
                    />
                  </div>
                  <div className="svy-fields">
                    <div className="field">
                      <label>Company name</label>
                      <input
                        value={company.companyName}
                        onChange={(e) => patchCompany({ companyName: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Tagline</label>
                      <input
                        value={company.tagline}
                        onChange={(e) => patchCompany({ tagline: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Website</label>
                      <input
                        value={company.website}
                        onChange={(e) => patchCompany({ website: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>LinkedIn</label>
                      <input
                        value={company.linkedIn}
                        onChange={(e) => patchCompany({ linkedIn: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Business registration number</label>
                      <input
                        value={company.registrationNumber}
                        onChange={(e) => patchCompany({ registrationNumber: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Tax ID / EIN (optional)</label>
                      <input
                        value={company.taxId}
                        onChange={(e) => patchCompany({ taxId: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Business type</label>
                      <select
                        value={company.businessType ?? ''}
                        onChange={(e) =>
                          patchCompany({
                            businessType: (e.target.value || null) as CompanyIdentity['businessType'],
                          })
                        }
                      >
                        <option value="">Select…</option>
                        {BUSINESS_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {BUSINESS_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Founded year</label>
                      <input
                        value={company.foundedYear}
                        onChange={(e) => patchCompany({ foundedYear: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Number of employees</label>
                      <input
                        type="number"
                        min={0}
                        value={company.employeeCount ?? ''}
                        onChange={(e) =>
                          patchCompany({
                            employeeCount: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>About company</label>
                    <textarea
                      rows={6}
                      value={company.aboutCompany}
                      onChange={(e) => patchCompany({ aboutCompany: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Head office address</label>
                    <textarea
                      rows={2}
                      value={company.headOfficeAddress}
                      onChange={(e) => patchCompany({ headOfficeAddress: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Office locations (comma-separated)</label>
                    <input
                      value={company.officeLocations.map((o) => o.city).join(', ')}
                      onChange={(e) =>
                        patchCompany({
                          officeLocations: e.target.value
                            .split(',')
                            .map((city) => city.trim())
                            .filter(Boolean)
                            .map((city) => ({ id: newEntryId(), city })),
                        })
                      }
                      placeholder="Houston, Dallas, Austin"
                    />
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Company capacity</h2>
                    </div>
                  </div>
                  <div className="svy-fields">
                    <div className="field">
                      <label>Projects handled annually</label>
                      <input
                        type="number"
                        value={company.projectsHandledAnnually ?? ''}
                        onChange={(e) =>
                          patchCompany({
                            projectsHandledAnnually: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Largest project</label>
                      <input
                        value={company.largestProject}
                        onChange={(e) => patchCompany({ largestProject: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Average team size</label>
                      <input
                        type="number"
                        value={company.averageTeamSize ?? ''}
                        onChange={(e) =>
                          patchCompany({
                            averageTeamSize: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Concurrent projects</label>
                      <input
                        type="number"
                        value={company.concurrentProjects ?? ''}
                        onChange={(e) =>
                          patchCompany({
                            concurrentProjects: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Company certifications</h2>
                    </div>
                  </div>
                  <div className="svy-service-grid">
                    {COMPANY_CERTIFICATIONS.map((c) => {
                      const selected = company.companyCertifications.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`svy-service${selected ? ' is-selected' : ''}`}
                          onClick={() =>
                            patchCompany({
                              companyCertifications: toggleInList(
                                company.companyCertifications,
                                c,
                              ),
                            })
                          }
                        >
                          <span className="svy-service-check">
                            {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                          </span>
                          <span>{COMPANY_CERTIFICATION_LABELS[c]}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Social links</h2>
                    </div>
                  </div>
                  <div className="svy-fields">
                    <div className="field">
                      <label>Facebook</label>
                      <input
                        value={company.facebook}
                        onChange={(e) => patchCompany({ facebook: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Instagram</label>
                      <input
                        value={company.instagram}
                        onChange={(e) => patchCompany({ instagram: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>YouTube</label>
                      <input
                        value={company.youtube}
                        onChange={(e) => patchCompany({ youtube: e.target.value })}
                      />
                    </div>
                  </div>
                </section>

                <section className="svy-panel">
                  <div className="svy-panel-head">
                    <div>
                      <h2>Awards</h2>
                      <p>One per line</p>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={company.awards.join('\n')}
                    onChange={(e) =>
                      patchCompany({
                        awards: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </section>
              </>
            ) : null}
          </div>
        )}

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
                  : 'Unlocks automatically once your portfolio hits 100%.'}
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
            {busy ? 'Saving…' : mode === 'edit' ? 'Save portfolio' : 'Create portfolio'}
          </button>
        </footer>
      </form>
    </div>
  );
}
