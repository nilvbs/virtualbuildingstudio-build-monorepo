'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, Info, Lock, Mail, Shield } from 'lucide-react';
import { api, errorMessage } from '../../../lib/api';
import { setSession } from '../../../lib/session';

const DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === 'true';
const DEV_EMAIL = 'dev@surveylink.local';
const DEV_PASSWORD = 'devpass123';

export default function AdminLoginPage() {
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
      if (!me.roles.includes('admin') && !(me.memberships ?? []).includes('admin')) {
        setError('This portal is for SurveyLink staff only.');
        return;
      }
      router.push('/build/admin/queue');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="staff-shell">
      <aside className="staff-aside" aria-hidden>
        <div className="staff-aside-inner">
          <Image
            src="/brand/bld-logo-dark.png"
            alt=""
            width={636}
            height={236}
            className="staff-aside-logo"
            priority
          />
          <p className="staff-aside-kicker">
            <Shield size={13} strokeWidth={2.4} />
            Staff portal
          </p>
          <h2 className="staff-aside-title">Operations workspace</h2>
          <p className="staff-aside-copy">
            Match surveyors, manage clients, and keep delivery moving — invite-only access for BLD
            administrators.
          </p>
        </div>
      </aside>

      <section className="staff-main">
        <div className="staff-card">
          <div className="staff-card-brand staff-card-brand--mobile">
            <Image
              src="/brand/bld-logo-dark.png"
              alt="BLD"
              width={636}
              height={236}
              className="staff-logo"
              priority
            />
          </div>

          <p className="staff-kicker">
            <Shield size={13} strokeWidth={2.4} />
            Staff portal
          </p>
          <h1 className="staff-title">Operations sign in</h1>
          <p className="staff-lede">Restricted access for BLD administrators.</p>

          <form className="staff-form" onSubmit={onSubmit} noValidate>
            {DEV_MODE && (
              <div className="alert info">
                <Info size={17} />
                <span>Dev mode: prefilled with the fixed admin test account.</span>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Work email</label>
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
            <button className="btn block" type="submit" disabled={busy}>
              {busy ? <span className="spin" /> : null}
              {busy ? 'Signing in…' : 'Sign in to operations'}
            </button>
          </form>

          <p className="staff-foot">
            Staff access is invite-only. Contact your super admin if you need an account.
          </p>
        </div>
      </section>
    </main>
  );
}
