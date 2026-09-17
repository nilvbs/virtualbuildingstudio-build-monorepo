'use client';

import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import type { SignupAccountNotice } from '@surveylink/types';
import { takeAccountNotice } from '../lib/account-notice';

/** One-time banner after dual-role signup (same email → second workspace). */
export function AccountNoticeBanner() {
  const [notice, setNotice] = useState<SignupAccountNotice | null>(null);

  useEffect(() => {
    setNotice(takeAccountNotice());
  }, []);

  if (!notice) return null;

  return (
    <div className="alert info" role="status">
      <Info size={17} aria-hidden />
      <span style={{ flex: 1 }}>{notice.message}</span>
      <button
        type="button"
        className="plain"
        aria-label="Dismiss"
        onClick={() => setNotice(null)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          color: 'inherit',
          opacity: 0.7,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
