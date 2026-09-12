'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import type { AdminClientDetail } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { StatusBadge } from '../../../../../components/status';

function addressLines(c: AdminClientDetail): string[] {
  return [
    c.addressLine1,
    c.addressLine2,
    [c.city, c.state, c.postalCode].filter(Boolean).join(', ') || null,
    c.country,
  ].filter((v): v is string => Boolean(v?.trim()));
}

export default function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<AdminClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminClient(id)
      .then(setClient)
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
        <div className="card" style={{ marginTop: 16, height: 220 }} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="empty">
        <div className="empty-ico">
          <ShieldAlert size={24} />
        </div>
        <h3 style={{ fontSize: 18 }}>No access to clients</h3>
      </div>
    );
  }

  if (!client) {
    return (
      <>
        <div className="alert error">{error ?? 'Client not found.'}</div>
        <Link href="/build/admin/clients" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to clients
        </Link>
      </>
    );
  }

  const lines = addressLines(client);

  return (
    <div className="admin-dossier">
      <Link href="/build/admin/clients" className="admin-dossier-back plain">
        <ArrowLeft size={15} /> Clients
      </Link>

      <header className="admin-dossier-head">
        <div>
          <p className="ops-kicker">Client profile</p>
          <h1 className="admin-dossier-title">{client.fullName}</h1>
          <p className="admin-dossier-sub">
            {client.companyName ? `${client.companyName} · ` : ''}
            {client.accountType}
            {' · '}
            Joined {new Date(client.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link href={`/build/admin/projects?clientId=${client.id}`} className="btn">
          View projects ({client.projectCount})
        </Link>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="admin-dossier-grid">
        <section className="admin-dossier-card">
          <h2>Contact</h2>
          <dl className="admin-dossier-dl">
            <div>
              <dt>Email</dt>
              <dd>
                <Mail size={13} aria-hidden /> {client.email}
                {client.emailVerified ? <span className="admin-dossier-ok">Verified</span> : null}
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <Phone size={13} aria-hidden /> {client.phone}
                {client.phoneVerified ? <span className="admin-dossier-ok">Verified</span> : null}
              </dd>
            </div>
            {client.workEmail ? (
              <div>
                <dt>Work email</dt>
                <dd>
                  {client.workEmail}
                  {client.workEmailVerified ? <span className="admin-dossier-ok">Verified</span> : null}
                </dd>
              </div>
            ) : null}
            {client.website ? (
              <div>
                <dt>Website</dt>
                <dd>
                  <Globe size={13} aria-hidden /> {client.website}
                </dd>
              </div>
            ) : null}
            {client.registrationNumber ? (
              <div>
                <dt>Registration</dt>
                <dd>{client.registrationNumber}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="admin-dossier-card">
          <h2>Address</h2>
          {lines.length > 0 ? (
            <div className="admin-dossier-address">
              <MapPin size={16} aria-hidden />
              <div>
                {lines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
          ) : (
            <p className="admin-dossier-muted">No address on file.</p>
          )}
          {client.companyName ? (
            <p className="admin-dossier-company">
              <Building2 size={14} aria-hidden /> {client.companyName}
            </p>
          ) : null}
        </section>
      </div>

      <section className="admin-dossier-card" style={{ marginTop: 14 }}>
        <div className="admin-dossier-card-head">
          <h2>Projects posted</h2>
          <Link href={`/build/admin/projects?clientId=${client.id}`} className="plain admin-dossier-link">
            Open in projects module
          </Link>
        </div>
        {client.projects.length === 0 ? (
          <p className="admin-dossier-muted">This client has not posted any projects yet.</p>
        ) : (
          <ul className="admin-dossier-projects">
            {client.projects.map((p) => (
              <li key={p.id}>
                <div>
                  <Link href={`/build/admin/projects/${p.id}`} className="admin-dossier-project-title plain">
                    {p.title}
                  </Link>
                  <div className="admin-dossier-project-meta">
                    <StatusBadge status={p.status} />
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {p.assignedSurveyor ? (
                  <Link
                    href={`/build/admin/surveyors/${p.assignedSurveyor.profileId}`}
                    className="admin-dossier-surveyor plain"
                  >
                    {p.assignedSurveyor.fullName}
                  </Link>
                ) : (
                  <span className="admin-dossier-muted">Unassigned</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
