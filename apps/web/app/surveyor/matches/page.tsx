'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import type { SurveyorStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/status';

export default function SurveyorMatchesPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SurveyorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSurveyorStatus()
      .then(setStatus)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <>
        <div className="skeleton sk-line" style={{ width: 180, height: 20 }} />
        <div className="card" style={{ marginTop: 20, height: 180 }} />
      </>
    );
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!status) return null;

  return (
    <>
      {!status.profileComplete ? (
        <div className="empty">
          <div className="empty-ico">
            <Handshake size={24} />
          </div>
          <h2 style={{ fontSize: 20 }}>Complete your portfolio first</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '8px auto 18px' }}>
            Matches appear once your portfolio is 100% complete and our team starts mapping projects to
            you.
          </p>
          <Link className="btn" href="/surveyor/profile">
            Finish portfolio · {status.completionPercent}%
          </Link>
        </div>
      ) : status.matches.filter((m) => m.status === 'accepted' || m.status === 'completed').length === 0 ? (
        <div className="empty">
          <div className="empty-ico">
            <Handshake size={24} />
          </div>
          <h2 style={{ fontSize: 20 }}>No matches yet</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '8px auto 0' }}>
            When a project fits your coverage and services, it will show up here.
          </p>
        </div>
      ) : (
        <section>
          <div className="section-title">
            Your matches <span className="count">{status.matches.filter((m) => m.status === 'accepted' || m.status === 'completed').length}</span>
          </div>
          <div className="list">
            {status.matches.filter((m) => m.status === 'accepted' || m.status === 'completed').map((m) => (
              <div className="row-item" key={m.matchId}>
                <div>
                  <strong>{m.projectTitle}</strong>
                  <div className="row-meta">{new Date(m.createdAt).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
