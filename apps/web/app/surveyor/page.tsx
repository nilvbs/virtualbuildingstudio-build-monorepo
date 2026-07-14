'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radar, Sparkles, UserRoundPlus } from 'lucide-react';
import type { SurveyorStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';

export default function SurveyorDashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SurveyorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSurveyorStatus()
      .then((next) => {
        if (!next.profileComplete) {
          router.replace('/surveyor/profile?complete=1');
          return;
        }
        setStatus(next);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <>
        <div className="skeleton sk-line" style={{ width: 140, height: 20 }} />
        <div className="card" style={{ marginTop: 20, height: 220 }} />
      </>
    );
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!status) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Surveyor</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Live matching status for your expert workspace.</p>
        </div>
        <Link className="btn secondary" href="/surveyor/profile">
          Edit profile
        </Link>
      </div>

      {!status.hasProfile ? (
        <div className="empty">
          <div className="empty-ico">
            <UserRoundPlus size={24} />
          </div>
          <h2 style={{ fontSize: 20 }}>{status.headline}</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '8px auto 18px' }}>
            {status.subtext}
          </p>
          <Link className="btn" href="/surveyor/profile">
            <UserRoundPlus size={17} /> Set up your profile
          </Link>
        </div>
      ) : (
        <section
          className="card card-pad-lg"
          style={{
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            background: 'var(--brand-grad-soft)',
            borderColor: 'transparent',
          }}
        >
          <div className="pulse" aria-hidden>
            {status.isMatchable ? <Radar size={26} /> : <Sparkles size={26} />}
          </div>
          <h2 style={{ fontSize: 25, margin: '18px 0 8px', maxWidth: 520 }}>{status.headline}</h2>
          <p style={{ color: 'var(--text-soft)', maxWidth: 480 }}>{status.subtext}</p>
          {!status.isMatchable && (
            <span className="badge badge-gray" style={{ marginTop: 16 }}>
              Profile paused — not receiving new matches
            </span>
          )}
          {status.matches.length > 0 && (
            <Link className="btn secondary" href="/surveyor/matches" style={{ marginTop: 18 }}>
              View {status.matches.length} match{status.matches.length === 1 ? '' : 'es'}
            </Link>
          )}
        </section>
      )}
    </>
  );
}
