'use client';

import { useState } from 'react';
import type { RoleHint } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** "Continue with Google" — resolves the provider URL then hands off the browser. */
export function GoogleButton({
  role,
  label = 'Continue with Google',
}: {
  role?: RoleHint;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { url } = await api.googleStartUrl(role, redirectUri);
      window.location.href = url;
    } catch (err) {
      const msg = errorMessage(err);
      setError(
        msg === 'Failed to fetch' || msg.toLowerCase().includes('fetch')
          ? 'Cannot reach the API (http://localhost:4000). Start it with: pnpm --filter @surveylink/api dev'
          : msg,
      );
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn social mkt-auth-google" onClick={onClick} disabled={busy}>
        {busy ? <span className="spin dark" /> : <GoogleGlyph />}
        {busy ? 'Redirecting to Google…' : label}
      </button>
      {error && (
        <p className="hint" style={{ color: 'var(--danger, #d64545)', marginTop: 8 }}>
          {error}
        </p>
      )}
    </>
  );
}
