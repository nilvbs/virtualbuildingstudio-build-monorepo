'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Phone, ShieldAlert, Wrench } from 'lucide-react';
import { SURVEY_SERVICE_LABELS, type AdminSurveyorDetail, type SurveyService } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { LocationMapPreview } from '../../../../../components/location-map-preview';

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

  const identity = surveyor.details.identity;
  const about =
    identity?.kind === 'individual'
      ? identity.aboutMe || identity.headline
      : identity?.kind === 'company'
        ? identity.aboutCompany || identity.tagline
        : surveyor.bio;

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
          </p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

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
              <dt>Coverage</dt>
              <dd>{surveyor.radiusKm} km radius</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>{surveyor.bldVerified ? 'BLD verified' : 'Not BLD verified'}</dd>
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
            <Wrench size={14} aria-hidden /> {surveyor.equipment.join(' · ')}
          </p>
        ) : null}
      </section>

      <section className="admin-dossier-card" style={{ marginTop: 14 }}>
        <h2>Portfolio / identity</h2>
        {about ? <p className="admin-dossier-about">{about}</p> : (
          <p className="admin-dossier-muted">No portfolio bio yet.</p>
        )}
        {identity?.kind === 'individual' && identity.headline ? (
          <p className="admin-dossier-muted">Headline: {identity.headline}</p>
        ) : null}
        {identity?.kind === 'company' && identity.companyName ? (
          <p className="admin-dossier-muted">Company: {identity.companyName}</p>
        ) : null}
      </section>
    </div>
  );
}
