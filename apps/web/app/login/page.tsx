'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Compass, Info, Lock, Mail } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { setSession } from '../../lib/session';

const DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === 'true';
const DEV_EMAIL = 'dev@surveylink.local';
const DEV_PASSWORD = 'devpass123';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEV_MODE ? DEV_EMAIL : '');
  const [password, setPassword] = useState(DEV_MODE ? DEV_PASSWORD : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await api.login({ email, password });
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + session.expiresIn * 1000,
      });
      const me = await api.me();
      // Marketplace login: send people to the workspace that matches their hint.
      // Staff should use /build/admin instead.
      if (me.roleHint === 'client') router.push('/client');
      else router.push('/surveyor');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <Compass size={19} strokeWidth={2.4} />
          </span>
          <span className="brand-name" style={{ fontSize: 18 }}>
            SurveyLink
          </span>
        </div>

        <div className="auth-panel">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Welcome back</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 22 }}>
            Sign in as a client or surveyor.
          </p>

          <form onSubmit={onSubmit} noValidate>
            {DEV_MODE && (
              <div className="alert info">
                <Info size={17} />
                <span>Dev mode: prefilled with the fixed test account.</span>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="input-icon">
                <Mail size={16} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-icon">
                <Lock size={16} />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <button className="btn block" type="submit" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? <span className="spin" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="auth-foot">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
