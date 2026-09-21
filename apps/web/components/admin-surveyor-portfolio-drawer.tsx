'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Circle,
  DollarSign,
  Loader2,
  MapPin,
  Pencil,
  Wrench,
  X,
} from 'lucide-react';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_LABELS,
  SURVEY_SERVICE_GROUPS,
  SURVEY_SERVICE_LABELS,
  SURVEYOR_PROFILE_COMPLETION_CHECKS,
  type AdminSurveyorDetail,
  type AvailabilityOption,
  type EquipmentId,
  type SurveyService,
  type SurveyorPortfolioDetails,
  type SurveyorProfileCompletionKey,
} from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { toastError, toastSuccess } from '../lib/action-toast';

const CoverageMapPreview = dynamic(
  () => import('./coverage-map-preview').then((m) => m.CoverageMapPreview),
  {
    ssr: false,
    loading: () => <div className="admin-pf-map-loading">Loading map…</div>,
  },
);

type AccordionId = 'overview' | 'services' | 'coverage' | 'rates' | 'about';

const EDIT_STEPS: { id: AccordionId; label: string; hint: string }[] = [
  { id: 'services', label: 'Services', hint: 'What they deliver' },
  { id: 'coverage', label: 'Coverage', hint: 'Where they work' },
  { id: 'rates', label: 'Rates & kit', hint: 'Pricing and gear' },
  { id: 'about', label: 'About', hint: 'Bio and notes' },
];

const VIEW_STEPS: { id: AccordionId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Completion status' },
  { id: 'services', label: 'Services', hint: 'Offerings and kit' },
  { id: 'coverage', label: 'Coverage', hint: 'Base location' },
  { id: 'rates', label: 'Rates', hint: 'Pricing and availability' },
  { id: 'about', label: 'About', hint: 'Bio' },
];

function cents(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${(v / 100).toFixed(0)}`;
}

function dollarsFromCents(v: number | null | undefined): string {
  if (v == null) return '';
  return String(Math.round(v / 100));
}

function centsFromDollars(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseCoord(value: string): number | null {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
}

function aboutText(surveyor: AdminSurveyorDetail): string {
  const identity = surveyor.details?.identity;
  if (identity?.kind === 'individual') {
    return identity.aboutMe || identity.headline || surveyor.bio || '';
  }
  if (identity?.kind === 'company') {
    return identity.aboutCompany || identity.tagline || surveyor.bio || '';
  }
  return surveyor.bio || '';
}

type EditForm = {
  about: string;
  services: SurveyService[];
  equipment: string[];
  dayRate: string;
  hourlyRate: string;
  availability: AvailabilityOption | '';
  isMatchable: boolean;
  radiusKm: string;
  baseCity: string;
  lat: string;
  lng: string;
};

function formFromSurveyor(s: AdminSurveyorDetail): EditForm {
  return {
    about: aboutText(s),
    services: [...s.services],
    equipment: [...s.equipment],
    dayRate: dollarsFromCents(s.dayRateCents),
    hourlyRate: dollarsFromCents(s.details?.hourlyRateCents),
    availability: (s.details?.availability as AvailabilityOption | null) ?? '',
    isMatchable: s.isMatchable,
    radiusKm: String(s.radiusKm ?? 25),
    baseCity: s.baseCity ?? '',
    lat: s.location ? String(s.location.lat) : '',
    lng: s.location ? String(s.location.lng) : '',
  };
}

function Accordion({
  id,
  label,
  hint,
  open,
  onToggle,
  summary,
  children,
}: {
  id: AccordionId;
  label: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <section className={`admin-pf-acc${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="admin-pf-acc-head"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`admin-pf-acc-${id}`}
      >
        <span className="admin-pf-acc-titles">
          <span className="admin-pf-acc-label">{label}</span>
          <span className="admin-pf-acc-hint">{open ? hint : summary || hint}</span>
        </span>
        <ChevronDown size={16} className="admin-pf-acc-chevron" aria-hidden />
      </button>
      {open ? (
        <div id={`admin-pf-acc-${id}`} className="admin-pf-acc-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

type Props = {
  userId: string;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
};

/**
 * Right-side portfolio drawer for a surveyor (admin view).
 * View-only by default; circled pencil unlocks step accordion edit.
 */
export function AdminSurveyorPortfolioDrawer({ userId, open, onClose, canEdit = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [openStep, setOpenStep] = useState<AccordionId>('overview');
  const [error, setError] = useState<string | null>(null);
  const [surveyor, setSurveyor] = useState<AdminSurveyorDetail | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setEditing(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSurveyor(null);
    setForm(null);
    setEditing(false);
    setOpenStep('overview');
    api
      .getAdminSurveyor(userId)
      .then((row) => {
        if (!cancelled) {
          setSurveyor(row);
          setForm(formFromSurveyor(row));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) {
          cancelEdit();
          return;
        }
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, editing]);

  function toggleStep(id: AccordionId) {
    setOpenStep(id);
  }

  function enterEdit() {
    if (!surveyor) return;
    setForm(formFromSurveyor(surveyor));
    setError(null);
    setEditing(true);
    setOpenStep('services');
  }

  function cancelEdit() {
    if (surveyor) setForm(formFromSurveyor(surveyor));
    setError(null);
    setEditing(false);
    setOpenStep('overview');
  }

  function toggleService(svc: SurveyService) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.services.includes(svc);
      return {
        ...prev,
        services: has ? prev.services.filter((s) => s !== svc) : [...prev.services, svc],
      };
    });
  }

  function toggleEquipment(id: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.equipment.includes(id);
      return {
        ...prev,
        equipment: has ? prev.equipment.filter((e) => e !== id) : [...prev.equipment, id],
      };
    });
  }

  async function onSave() {
    if (!form || !surveyor) return;
    if (form.services.length < 1) {
      setError('Select at least one service.');
      setOpenStep('services');
      return;
    }
    const radiusKm = Number(form.radiusKm);
    if (!Number.isFinite(radiusKm) || radiusKm < 1) {
      setError('Coverage radius must be at least 1 km.');
      setOpenStep('coverage');
      return;
    }

    const details: SurveyorPortfolioDetails = {
      ...surveyor.details,
      availability: form.availability || null,
      currency: 'USD',
      hourlyRateCents: centsFromDollars(form.hourlyRate),
    };

    const identity = details.identity;
    if (identity?.kind === 'individual') {
      details.identity = { ...identity, aboutMe: form.about };
    } else if (identity?.kind === 'company') {
      details.identity = { ...identity, aboutCompany: form.about };
    }

    const lat = form.lat.trim() ? Number(form.lat) : null;
    const lng = form.lng.trim() ? Number(form.lng) : null;
    const hasLoc = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateAdminSurveyor(userId, {
        bio: form.about || undefined,
        services: form.services,
        equipment: form.equipment,
        baseCity: form.baseCity.trim() || undefined,
        radiusKm,
        dayRateCents: centsFromDollars(form.dayRate) ?? undefined,
        isMatchable: form.isMatchable,
        details,
        ...(hasLoc ? { location: { lat, lng } } : {}),
      });
      setSurveyor(updated);
      setForm(formFromSurveyor(updated));
      setEditing(false);
      setOpenStep('overview');
      toastSuccess('Saved', 'Surveyor portfolio updated.');
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toastError('Could not save', msg);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  const details = surveyor?.details;
  const about = surveyor ? aboutText(surveyor) : '';
  const missing = new Set((surveyor?.missingChecks ?? []) as SurveyorProfileCompletionKey[]);
  const steps = editing ? EDIT_STEPS : VIEW_STEPS;

  function stepSummary(id: AccordionId): string {
    if (!surveyor) return '';
    if (id === 'overview') {
      return surveyor.profileComplete
        ? 'Profile complete'
        : `${surveyor.completionPercent}% · ${missing.size} left`;
    }
    if (id === 'services') {
      const n = editing && form ? form.services.length : surveyor.services.length;
      return n ? `${n} selected` : 'None set';
    }
    if (id === 'coverage') {
      const city = editing && form ? form.baseCity : surveyor.baseCity;
      return city || 'No base city';
    }
    if (id === 'rates') {
      const rate = editing && form ? form.dayRate : dollarsFromCents(surveyor.dayRateCents);
      return rate ? `$${rate}/day` : 'No day rate';
    }
    if (id === 'about') {
      const text = (editing && form ? form.about : about).trim();
      if (!text) return 'Empty';
      return text.length > 36 ? `${text.slice(0, 36)}…` : text;
    }
    return '';
  }

  return createPortal(
    <div className={`hd-drawer-root${visible ? ' is-open' : ''}`} role="presentation">
      <button
        type="button"
        className="hd-drawer-backdrop"
        aria-label="Close portfolio"
        onClick={() => {
          if (editing) cancelEdit();
          onClose();
        }}
      />
      <aside
        className={`hd-drawer-panel admin-user-portfolio-panel${editing ? ' is-editing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Surveyor portfolio"
      >
        <header className="hd-drawer-head admin-pf-head">
          <div className="hd-drawer-brand">
            <span className="hd-drawer-ico" aria-hidden>
              <Briefcase size={16} />
            </span>
            <div>
              <h2>{surveyor?.fullName ?? 'Surveyor portfolio'}</h2>
              <p className="hd-drawer-sub">
                {editing
                  ? 'Edit portfolio'
                  : surveyor
                    ? `${surveyor.baseCity || 'No base city'} · ${surveyor.profileComplete ? 'Complete' : `${surveyor.completionPercent}%`}`
                    : 'Loading…'}
              </p>
            </div>
          </div>
          <div className="admin-user-portfolio-head-actions">
            {canEdit && surveyor && !editing ? (
              <button
                type="button"
                className="admin-user-pencil"
                onClick={enterEdit}
                aria-label="Edit portfolio"
                title="Edit portfolio"
              >
                <Pencil size={15} aria-hidden />
              </button>
            ) : null}
            <button type="button" className="hd-drawer-close" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="hd-drawer-body admin-user-portfolio-body">
          {loading ? (
            <div className="admin-user-portfolio-loading">
              <Loader2 size={20} className="hd-action-toast-spin" aria-hidden />
              Loading portfolio…
            </div>
          ) : null}

          {error ? <div className="alert error">{error}</div> : null}

          {surveyor && details && form && !loading ? (
            <div className="admin-pf-stack">
              {steps.map((step) => (
                <Accordion
                  key={step.id}
                  id={step.id}
                  label={step.label}
                  hint={step.hint}
                  open={openStep === step.id}
                  onToggle={() => toggleStep(step.id)}
                  summary={stepSummary(step.id)}
                >
                  {step.id === 'overview' && !editing ? (
                    <ul className="admin-pf-checks">
                      {SURVEYOR_PROFILE_COMPLETION_CHECKS.map((c) => {
                        const ok = !missing.has(c.key);
                        return (
                          <li key={c.key} className={ok ? 'is-done' : 'is-missing'}>
                            {ok ? (
                              <CheckCircle2 size={14} aria-hidden />
                            ) : (
                              <Circle size={14} aria-hidden />
                            )}
                            {c.label}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {step.id === 'services' ? (
                    editing ? (
                      <div className="admin-pf-groups">
                        {SURVEY_SERVICE_GROUPS.map((group) => (
                          <div key={group.id} className="admin-pf-group">
                            <p className="admin-pf-group-label">{group.label}</p>
                            <div className="admin-pf-chips">
                              {group.services.map((s) => {
                                const selected = form.services.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`admin-pf-chip${selected ? ' is-on' : ''}`}
                                    onClick={() => toggleService(s)}
                                  >
                                    {SURVEY_SERVICE_LABELS[s]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-pf-view-block">
                        <div className="admin-pf-chips is-static">
                          {surveyor.services.length > 0 ? (
                            surveyor.services.map((s) => (
                              <span key={s} className="admin-pf-chip is-on">
                                {SURVEY_SERVICE_LABELS[s as SurveyService] ?? s}
                              </span>
                            ))
                          ) : (
                            <span className="admin-dossier-muted">No services set</span>
                          )}
                        </div>
                        {surveyor.equipment.length > 0 ? (
                          <p className="admin-pf-equip">
                            <Wrench size={13} aria-hidden />
                            {surveyor.equipment
                              .map((id) => EQUIPMENT_LABELS[id as EquipmentId] ?? id)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    )
                  ) : null}

                  {step.id === 'coverage' ? (
                    editing ? (
                      <div className="admin-pf-coverage">
                        <div className="admin-pf-map">
                          <CoverageMapPreview
                            className="admin-pf-coverage-map"
                            lat={parseCoord(form.lat)}
                            lng={parseCoord(form.lng)}
                            radiusKm={Math.max(1, Number(form.radiusKm) || 25)}
                            label={form.baseCity || null}
                            showRadius
                            counties={(details.coverageCounties ?? []).filter(
                              (c) => c.selected !== false,
                            )}
                            areas={(details.coverageCounties ?? [])
                              .filter((c) => c.selected !== false)
                              .map((c) => c.county.replace(/\s+County$/i, ''))}
                          />
                        </div>
                        <div className="admin-pf-fields">
                          <label className="admin-pf-field admin-pf-span-2">
                            <span>Base city</span>
                            <input
                              className="admin-pf-input"
                              value={form.baseCity}
                              onChange={(e) => setForm({ ...form, baseCity: e.target.value })}
                            />
                          </label>
                          <label className="admin-pf-field">
                            <span>Radius (km)</span>
                            <input
                              className="admin-pf-input"
                              inputMode="numeric"
                              value={form.radiusKm}
                              onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
                            />
                          </label>
                          <label className="admin-pf-field">
                            <span>Latitude</span>
                            <input
                              className="admin-pf-input"
                              inputMode="decimal"
                              value={form.lat}
                              onChange={(e) => setForm({ ...form, lat: e.target.value })}
                            />
                          </label>
                          <label className="admin-pf-field">
                            <span>Longitude</span>
                            <input
                              className="admin-pf-input"
                              inputMode="decimal"
                              value={form.lng}
                              onChange={(e) => setForm({ ...form, lng: e.target.value })}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-pf-coverage">
                        <p className="admin-pf-loc">
                          <MapPin size={14} aria-hidden />
                          <span>
                            {surveyor.baseCity || 'No base city on file'}
                            {surveyor.location
                              ? ` · ${surveyor.location.lat.toFixed(4)}, ${surveyor.location.lng.toFixed(4)}`
                              : ''}
                            {` · ${surveyor.radiusKm} km`}
                          </span>
                        </p>
                        <div className="admin-pf-map">
                          <CoverageMapPreview
                            className="admin-pf-coverage-map"
                            lat={surveyor.location?.lat ?? null}
                            lng={surveyor.location?.lng ?? null}
                            radiusKm={surveyor.radiusKm}
                            label={surveyor.baseCity}
                            showRadius
                            counties={(details.coverageCounties ?? []).filter(
                              (c) => c.selected !== false,
                            )}
                            areas={(details.coverageCounties ?? [])
                              .filter((c) => c.selected !== false)
                              .map((c) => c.county.replace(/\s+County$/i, ''))}
                          />
                        </div>
                      </div>
                    )
                  ) : null}

                  {step.id === 'rates' ? (
                    editing ? (
                      <div className="admin-pf-rates">
                        <div className="admin-pf-fields">
                          <label className="admin-pf-field">
                            <span>Day rate (USD)</span>
                            <input
                              className="admin-pf-input"
                              inputMode="decimal"
                              value={form.dayRate}
                              onChange={(e) => setForm({ ...form, dayRate: e.target.value })}
                            />
                          </label>
                          <label className="admin-pf-field">
                            <span>Hourly (USD)</span>
                            <input
                              className="admin-pf-input"
                              inputMode="decimal"
                              value={form.hourlyRate}
                              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                            />
                          </label>
                          <label className="admin-pf-field admin-pf-span-2">
                            <span>Availability</span>
                            <select
                              className="admin-pf-input"
                              value={form.availability}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  availability: e.target.value as AvailabilityOption | '',
                                })
                              }
                            >
                              <option value="">—</option>
                              {AVAILABILITY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {AVAILABILITY_LABELS[opt]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="admin-pf-check admin-pf-span-2">
                            <input
                              type="checkbox"
                              checked={form.isMatchable}
                              onChange={(e) =>
                                setForm({ ...form, isMatchable: e.target.checked })
                              }
                            />
                            <span>Matchable for new projects</span>
                          </label>
                        </div>
                        <div className="admin-pf-groups">
                          {EQUIPMENT_GROUPS.map((group) => (
                            <div key={group.id} className="admin-pf-group">
                              <p className="admin-pf-group-label">{group.label}</p>
                              <div className="admin-pf-chips">
                                {group.items.map((id) => {
                                  const selected = form.equipment.includes(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      className={`admin-pf-chip${selected ? ' is-on' : ''}`}
                                      onClick={() => toggleEquipment(id)}
                                    >
                                      {EQUIPMENT_LABELS[id as EquipmentId] ?? id}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <dl className="admin-pf-dl">
                        <div>
                          <dt>
                            <DollarSign size={12} aria-hidden /> Day
                          </dt>
                          <dd>{cents(surveyor.dayRateCents)}</dd>
                        </div>
                        <div>
                          <dt>Hourly</dt>
                          <dd>{cents(details.hourlyRateCents)}</dd>
                        </div>
                        <div>
                          <dt>Currency</dt>
                          <dd>{details.currency || 'USD'}</dd>
                        </div>
                        <div>
                          <dt>Availability</dt>
                          <dd>
                            {details.availability
                              ? AVAILABILITY_LABELS[details.availability as AvailabilityOption]
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>Matchable</dt>
                          <dd>{surveyor.isMatchable ? 'Yes' : 'Paused'}</dd>
                        </div>
                      </dl>
                    )
                  ) : null}

                  {step.id === 'about' ? (
                    editing ? (
                      <label className="admin-pf-field admin-pf-span-2">
                        <span>About</span>
                        <textarea
                          className="admin-pf-input admin-pf-textarea"
                          rows={4}
                          value={form.about}
                          onChange={(e) => setForm({ ...form, about: e.target.value })}
                          placeholder="Short bio or company summary"
                        />
                      </label>
                    ) : about ? (
                      <p className="admin-pf-about">{about}</p>
                    ) : (
                      <span className="admin-dossier-muted">No about text</span>
                    )
                  ) : null}
                </Accordion>
              ))}

              {editing ? (
                <div className="admin-pf-foot">
                  <button
                    type="button"
                    className="btn secondary sm admin-pf-btn"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary sm admin-pf-btn"
                    disabled={saving}
                    onClick={() => void onSave()}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="hd-action-toast-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      'Save portfolio'
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
