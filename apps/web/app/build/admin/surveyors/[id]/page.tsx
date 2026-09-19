'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Star,
  Wrench,
} from 'lucide-react';
import {
  AVAILABILITY_LABELS,
  DAILY_CAPTURE_CAPACITY_LABELS,
  DOCUMENT_TYPE_LABELS,
  EQUIPMENT_LABELS,
  INDUSTRY_LABELS,
  PORTFOLIO_LANGUAGE_LABELS,
  SURVEY_SERVICE_LABELS,
  SURVEYOR_PROFILE_COMPLETION_CHECKS,
  type AdminSurveyorDetail,
  type AvailabilityOption,
  type DailyCaptureCapacity,
  type DocumentType,
  type EquipmentId,
  type IndustryServed,
  type PortfolioLanguage,
  type SurveyService,
  type SurveyorProfileCompletionKey,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { LocationMapPreview } from '../../../../../components/location-map-preview';

function cents(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `$${(v / 100).toFixed(0)}`;
}

function equipmentLabel(id: string): string {
  return EQUIPMENT_LABELS[id as EquipmentId] ?? id;
}

export default function AdminSurveyorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [surveyor, setSurveyor] = useState<AdminSurveyorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminSurveyor(id)
      .then(setSurveyor)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="admin-dossier">
        <div className="skeleton sk-line" style={{ width: 180, height: 22 }} />
        <div className="card" style={{ marginTop: 16, height: 260 }} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="empty">
        <div className="empty-ico">
          <ShieldAlert size={24} />
        </div>
        <h3 style={{ fontSize: 18 }}>No access to surveyors</h3>
      </div>
    );
  }

  if (!surveyor) {
    return (
      <>
        <div className="alert error">{error ?? 'Surveyor not found.'}</div>
        <Link href="/build/admin/surveyors" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to surveyors
        </Link>
      </>
    );
  }

  const details = surveyor.details;
  const identity = details.identity;
  const about =
    identity?.kind === 'individual'
      ? identity.aboutMe || identity.headline
      : identity?.kind === 'company'
        ? identity.aboutCompany || identity.tagline
        : surveyor.bio;
  const missing = new Set(surveyor.missingChecks as SurveyorProfileCompletionKey[]);
  const selectedCounties = (details.coverageCounties ?? []).filter((c) => c.selected !== false);

  return (
    <div className="admin-dossier">
      <Link href="/build/admin/surveyors" className="admin-dossier-back plain">
        <ArrowLeft size={15} /> Surveyors
      </Link>

      <header className="admin-dossier-head">
        <div>
          <p className="ops-kicker">Surveyor profile</p>
          <h1 className="admin-dossier-title">{surveyor.fullName}</h1>
          <p className="admin-dossier-sub">
            {surveyor.baseCity || 'No base city'}
            {' · '}
            {surveyor.isMatchable ? 'Matchable' : 'Paused'}
            {surveyor.dayRateCents != null
              ? ` · $${(surveyor.dayRateCents / 100).toFixed(0)}/day`
              : ''}
            {surveyor.ratingAvg != null
              ? ` · ${surveyor.ratingAvg.toFixed(1)}★ (${surveyor.ratingCount})`
              : ''}
          </p>
        </div>
        <div className="admin-dossier-head-badge">
          <span className={`admin-svy-complete${surveyor.profileComplete ? '' : ' is-partial'}`}>
            {surveyor.profileComplete ? (
              <>
                <CheckCircle2 size={14} aria-hidden /> Profile complete
              </>
            ) : (
              <>{surveyor.completionPercent}% complete</>
            )}
          </span>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="admin-dossier-card" style={{ marginBottom: 14 }}>
        <h2>Completion checklist</h2>
        <ul className="admin-dossier-checks">
          {SURVEYOR_PROFILE_COMPLETION_CHECKS.map((c) => {
            const ok = !missing.has(c.key);
            return (
              <li key={c.key} className={ok ? 'is-done' : 'is-missing'}>
                {ok ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
                {c.label}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="admin-dossier-grid">
        <section className="admin-dossier-card">
          <h2>Contact</h2>
          <dl className="admin-dossier-dl">
            <div>
              <dt>Email</dt>
              <dd>
                <Mail size={13} aria-hidden /> {surveyor.email}
                {surveyor.emailVerified ? <span className="admin-dossier-ok">Verified</span> : null}
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <Phone size={13} aria-hidden /> {surveyor.phone}
                {surveyor.phoneVerified ? <span className="admin-dossier-ok">Verified</span> : null}
              </dd>
            </div>
            <div>
              <dt>Coverage radius</dt>
              <dd>{surveyor.radiusKm} km</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>{surveyor.bldVerified ? 'BLD verified' : 'Not BLD verified'}</dd>
            </div>
            <div>
              <dt>Onboarding</dt>
              <dd>{surveyor.onboardingStep}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{new Date(surveyor.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-dossier-card">
          <h2>Base location</h2>
          {surveyor.location ? (
            <LocationMapPreview
              lat={surveyor.location.lat}
              lng={surveyor.location.lng}
              label={surveyor.baseCity}
            />
          ) : (
            <p className="admin-dossier-muted">
              <MapPin size={14} aria-hidden /> No map pin on file
              {surveyor.baseCity ? ` · ${surveyor.baseCity}` : ''}.
            </p>
          )}
        </section>
      </div>

      <section className="admin-dossier-card" style={{ marginTop: 14 }}>
        <h2>Services & equipment</h2>
        <div className="admin-dossier-tags">
          {surveyor.services.length > 0 ? (
            surveyor.services.map((s) => (
              <span key={s} className="admin-svy-tag">
                {SURVEY_SERVICE_LABELS[s as SurveyService] ?? s}
              </span>
            ))
          ) : (
            <span className="admin-dossier-muted">No services set</span>
          )}
        </div>
        {surveyor.equipment.length > 0 ? (
          <p className="admin-dossier-equipment">
            <Wrench size={14} aria-hidden />{' '}
            {surveyor.equipment.map(equipmentLabel).join(' · ')}
          </p>
        ) : (
          <p className="admin-dossier-muted" style={{ marginTop: 10 }}>
            No equipment listed.
          </p>
        )}
      </section>

      <div className="admin-dossier-grid" style={{ marginTop: 14 }}>
        <section className="admin-dossier-card">
          <h2>Pricing & availability</h2>
          <dl className="admin-dossier-dl">
            <div>
              <dt>Day rate</dt>
              <dd>{cents(surveyor.dayRateCents) ?? '—'}</dd>
            </div>
            <div>
              <dt>Hourly</dt>
              <dd>{cents(details.hourlyRateCents) ?? '—'}</dd>
            </div>
            <div>
              <dt>Minimum project</dt>
              <dd>{cents(details.minimumProjectCents) ?? '—'}</dd>
            </div>
            <div>
              <dt>Emergency rate</dt>
              <dd>{cents(details.emergencyRateCents) ?? '—'}</dd>
            </div>
            <div>
              <dt>Travel</dt>
              <dd>
                {details.travelCharges === 'included'
                  ? 'Included'
                  : details.travelCharges === 'extra'
                    ? `Extra${details.travelExtraCents != null ? ` (${cents(details.travelExtraCents)})` : ''}`
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {details.availability
                  ? AVAILABILITY_LABELS[details.availability as AvailabilityOption]
                  : '—'}
                {details.busyUntil ? ` · busy until ${details.busyUntil}` : ''}
              </dd>
            </div>
            <div>
              <dt>Daily capture capacity</dt>
              <dd>
                {details.dailyCaptureCapacity
                  ? DAILY_CAPTURE_CAPACITY_LABELS[
                      details.dailyCaptureCapacity as DailyCaptureCapacity
                    ]
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Years reality capture</dt>
              <dd>
                {details.yearsRealityCapture != null ? details.yearsRealityCapture : '—'}
              </dd>
            </div>
            <div>
              <dt>GL insurance</dt>
              <dd>
                {details.generalLiabilityInsurance === true
                  ? 'Yes'
                  : details.generalLiabilityInsurance === false
                    ? 'No'
                    : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-dossier-card">
          <h2>Coverage & markets</h2>
          <dl className="admin-dossier-dl">
            <div>
              <dt>Countries</dt>
              <dd>
                {details.coverageCountries.length
                  ? details.coverageCountries.join(', ')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Counties</dt>
              <dd>
                {selectedCounties.length
                  ? selectedCounties
                      .slice(0, 12)
                      .map((c) => `${c.county}, ${c.state}`)
                      .join(', ') +
                    (selectedCounties.length > 12 ? ` +${selectedCounties.length - 12}` : '')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Travel nationwide</dt>
              <dd>{details.travelNationwide ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>International</dt>
              <dd>{details.internationalProjects ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Industries</dt>
              <dd>
                {details.industries.length
                  ? details.industries
                      .map((i) => INDUSTRY_LABELS[i as IndustryServed] ?? i)
                      .join(', ')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>
                {details.languages.length
                  ? details.languages
                      .map((l) => PORTFOLIO_LANGUAGE_LABELS[l as PortfolioLanguage] ?? l)
                      .join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="admin-dossier-card" style={{ marginTop: 14 }}>
        <h2>Portfolio / identity</h2>
        {about ? <p className="admin-dossier-about">{about}</p> : (
          <p className="admin-dossier-muted">No portfolio bio yet.</p>
        )}
        {identity?.kind === 'individual' ? (
          <dl className="admin-dossier-dl" style={{ marginTop: 12 }}>
            {identity.headline ? (
              <div>
                <dt>Headline</dt>
                <dd>{identity.headline}</dd>
              </div>
            ) : null}
            {identity.professionalTitle ? (
              <div>
                <dt>Title</dt>
                <dd>{identity.professionalTitle}</dd>
              </div>
            ) : null}
            {identity.currentCompany ? (
              <div>
                <dt>Company</dt>
                <dd>{identity.currentCompany}</dd>
              </div>
            ) : null}
            {identity.yearsExperience != null ? (
              <div>
                <dt>Years experience</dt>
                <dd>{identity.yearsExperience}</dd>
              </div>
            ) : null}
            {identity.skills.length > 0 ? (
              <div>
                <dt>Skills</dt>
                <dd>{identity.skills.join(', ')}</dd>
              </div>
            ) : null}
            {identity.memberships.length > 0 ? (
              <div>
                <dt>Memberships</dt>
                <dd>{identity.memberships.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {identity?.kind === 'company' ? (
          <dl className="admin-dossier-dl" style={{ marginTop: 12 }}>
            {identity.companyName ? (
              <div>
                <dt>Company</dt>
                <dd>{identity.companyName}</dd>
              </div>
            ) : null}
            {identity.tagline ? (
              <div>
                <dt>Tagline</dt>
                <dd>{identity.tagline}</dd>
              </div>
            ) : null}
            {identity.website ? (
              <div>
                <dt>Website</dt>
                <dd>
                  <a href={identity.website} target="_blank" rel="noreferrer">
                    {identity.website}
                  </a>
                </dd>
              </div>
            ) : null}
            {identity.businessType ? (
              <div>
                <dt>Business type</dt>
                <dd>{identity.businessType}</dd>
              </div>
            ) : null}
            {identity.employeeCount != null ? (
              <div>
                <dt>Employees</dt>
                <dd>{identity.employeeCount}</dd>
              </div>
            ) : null}
            {identity.headOfficeAddress ? (
              <div>
                <dt>Head office</dt>
                <dd>{identity.headOfficeAddress}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>

      {details.certifications.length > 0 ? (
        <section className="admin-dossier-card" style={{ marginTop: 14 }}>
          <h2>Certifications</h2>
          <ul className="admin-dossier-projects">
            {details.certifications.map((c) => (
              <li key={c.id}>
                <strong className="admin-dossier-project-title">{c.name || 'Certification'}</strong>
                <div className="admin-dossier-project-meta">
                  {[c.issuingOrganization, c.certificateNumber, c.expiryDate]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {details.documents.some((d) => d.fileKey) ? (
        <section className="admin-dossier-card" style={{ marginTop: 14 }}>
          <h2>Documents</h2>
          <ul className="admin-dossier-projects">
            {details.documents
              .filter((d) => d.fileKey)
              .map((d) => (
                <li key={`${d.type}-${d.fileKey}`}>
                  <a
                    href={d.fileKey!}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-dossier-project-title plain"
                  >
                    {DOCUMENT_TYPE_LABELS[d.type as DocumentType] ?? d.type}
                  </a>
                  {d.fileName ? (
                    <div className="admin-dossier-project-meta">{d.fileName}</div>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {details.projects.length > 0 ? (
        <section className="admin-dossier-card" style={{ marginTop: 14 }}>
          <h2>Past projects</h2>
          <ul className="admin-dossier-projects">
            {details.projects.map((p) => (
              <li key={p.id}>
                <strong className="admin-dossier-project-title">{p.title || 'Project'}</strong>
                <div className="admin-dossier-project-meta">
                  {[p.location, p.buildingType, p.completionYear, p.clientIndustry]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {p.description ? <p className="admin-dossier-about">{p.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {surveyor.ratingCount > 0 ? (
        <section className="admin-dossier-card" style={{ marginTop: 14 }}>
          <h2>Ratings</h2>
          <p className="admin-dossier-about">
            <Star size={14} aria-hidden /> {surveyor.ratingAvg?.toFixed(1)} average from{' '}
            {surveyor.ratingCount} review{surveyor.ratingCount === 1 ? '' : 's'}
          </p>
        </section>
      ) : null}
    </div>
  );
}
