'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, User } from 'lucide-react';
import type { WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { getSession, isAuthenticated, setSession } from '../../lib/session';
import { defaultPhoneInput, PhoneInput, phoneInputIsValid, phoneInputToE164 } from '../../components/phone-input';

function CompleteProfileForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [fullName, setFullName] = useState(params.get('name') ?? '');
  const [phone, setPhone] = useState(defaultPhoneInput);
  const roleHint: WorkspaceRole = 'surveyor';
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const email = params.get('email') ?? undefined;

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/sign-in');
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phoneInputIsValid(phone)) {
      setError('Enter a valid phone number for the selected country (E.164).');
      return;
    }
    setBusy(true);
    try {
      await api.completeRegistration({
        fullName,
        email,
        phone: phoneInputToE164(phone),
        roleHint,
      });
      const current = getSession();
      if (current) {
        setSession({ ...current, activeRole: roleHint });
      }
      router.replace('/onboarding');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <Image
          src="/brand/bld-logo-dark.png"
          alt="BLD"
          width={636}
          height={236}
          className="brand-logo"
          priority
        />
      </div>

      <div className="auth-panel">
        <p className="kicker" style={{ marginBottom: 4 }}>
          Almost there
        </p>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Finish setting up your account</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 22 }}>
          {email ? (
            <>
              Signed in as <strong>{email}</strong>. Just a couple more details.
            </>
          ) : (
            'Just a couple more details to get you started.'
          )}
        </p>

        <form onSubmit={onSubmit} noValidate>
          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <div className="input-icon">
              <User size={16} />
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <PhoneInput id="phone" value={phone} onChange={setPhone} required disabled={busy} />
          <p className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
            We&apos;ll text a code to verify it. You&apos;re joining as a surveyor.
          </p>

          <button className="btn block" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? <span className="spin" /> : null}
            {busy ? 'Finishing…' : 'Finish and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <main className="auth-shell">
      <Suspense fallback={<div className="auth-card">Loading…</div>}>
        <CompleteProfileForm />
      </Suspense>
    </main>
  );
}
