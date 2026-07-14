'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from '../../../lib/api';
import { homePathForRoleHint, homePathForWorkspace } from '../../../lib/home';
import { setSession } from '../../../lib/session';
import type { WorkspaceRole } from '@surveylink/types';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state') ?? '';
    const providerError = params.get('error_description') ?? params.get('error');

    if (providerError) {
      setError(providerError);
      return;
    }
    if (!code) {
      setError('Missing authorization code from Google.');
      return;
    }

    (async () => {
      try {
        const res = await api.exchangeGoogle({ code, state });
        // Prefer workspace from OAuth state (session.activeRole). Never force
        // "both" accounts onto /client — that ignored Expert (surveyor) signup.
        const activeRole: WorkspaceRole | undefined =
          res.session.activeRole === 'client' || res.session.activeRole === 'surveyor'
            ? res.session.activeRole
            : res.roleHint === 'surveyor' || res.roleHint === 'client'
              ? res.roleHint
              : undefined;
        setSession({
          accessToken: res.session.accessToken,
          refreshToken: res.session.refreshToken,
          expiresAt: Date.now() + res.session.expiresIn * 1000,
          activeRole,
        });

        if (res.registered) {
          router.replace(
            activeRole ? homePathForWorkspace(activeRole) : homePathForRoleHint(res.roleHint),
          );
          return;
        }

        const q = new URLSearchParams({
          role: activeRole ?? (res.roleHint === 'surveyor' ? 'surveyor' : 'client'),
          email: res.profile.email,
          name: res.profile.fullName,
        });
        router.replace(`/complete-profile?${q.toString()}`);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [params, router]);

  return (
    <main className="auth-shell">
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
        <div className="auth-panel" style={{ textAlign: 'center' }}>
          {error ? (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 6 }}>Couldn&apos;t finish sign-in</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>{error}</p>
              <Link href="/login" className="btn block">
                Back to sign in
              </Link>
            </>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', gap: 14, padding: '18px 0' }}>
              <span className="spin lg" />
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Finishing sign-in…</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="auth-shell" />}>
      <CallbackInner />
    </Suspense>
  );
}
