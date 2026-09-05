'use client';

import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

function CompletionRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = size >= 56 ? 5 : 4;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const center = size / 2;

  return (
    <div
      className="profile-meter-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Portfolio ${clamped}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="profile-meter-ring-track"
          cx={center}
          cy={center}
          r={r}
          strokeWidth={stroke}
        />
        <circle
          className="profile-meter-ring-fill"
          cx={center}
          cy={center}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="profile-meter-ring-value">{clamped}</span>
    </div>
  );
}

export function ProfileCompletionBar({
  percent,
  compact,
}: {
  percent: number;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`profile-completion${compact ? ' profile-completion--compact' : ''}`}>
      <div className="profile-completion-meta">
        <span>Portfolio</span>
        <strong>{clamped}%</strong>
      </div>
      <div
        className="profile-completion-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Portfolio completion"
      >
        <div className="profile-completion-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/** Compact sidebar meter — ring + short status line. */
export function SidebarProfileMeter({
  percent,
  complete,
}: {
  percent: number;
  complete: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={`sidebar-meter${complete ? ' is-complete' : ''}`}>
      <CompletionRing percent={clamped} size={52} />
      <div className="sidebar-meter-copy">
        <p className="sidebar-meter-label">{complete ? 'Portfolio ready' : 'Portfolio setup'}</p>
        <p className="sidebar-meter-sub">
          {complete ? 'Dashboard unlocked' : `${clamped}% complete`}
        </p>
        {!complete && (
          <Link href="/surveyor/profile" className="sidebar-meter-cta">
            Finish <ArrowRight size={13} strokeWidth={2.4} />
          </Link>
        )}
      </div>
    </div>
  );
}

export function IncompleteProfileModal({
  percent,
  open,
  onClose,
  onGoToProfile,
}: {
  percent: number;
  open: boolean;
  onClose: () => void;
  onGoToProfile: () => void;
}) {
  if (!open) return null;

  return (
    <div className="sheet-modal" role="presentation">
      <button type="button" className="sheet-modal-backdrop" aria-label="Dismiss" onClick={onClose} />
      <div
        className="sheet-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incomplete-profile-title"
      >
        <button type="button" className="sheet-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <p className="kicker" style={{ marginBottom: 6 }}>
          Almost ready
        </p>
        <h2 id="incomplete-profile-title" className="sheet-modal-title">
          Complete your portfolio
        </h2>
        <p className="sheet-modal-copy">
          Your progress is saved. Dashboard unlocks at 100% — finish the remaining details so we can
          match you to projects.
        </p>
        <ProfileCompletionBar percent={percent} />
        <div className="sheet-modal-actions">
          <button type="button" className="btn block" onClick={onGoToProfile}>
            Continue portfolio
          </button>
          <button type="button" className="btn secondary block" onClick={onClose}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
