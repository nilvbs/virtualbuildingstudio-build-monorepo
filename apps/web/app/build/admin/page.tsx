'use client';

import { useEffect, useState, type FormEvent, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Info, Lock, Mail, Shield } from 'lucide-react';
import { api, errorMessage } from '../../../lib/api';
import { setSession } from '../../../lib/session';

const DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === 'true';
const DEV_EMAIL = 'dev@surveylink.local';
const DEV_PASSWORD = 'devpass123';

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite')?.trim() ?? '';

  const [email, setEmail] = useState(DEV_MODE && !inviteToken ? DEV_EMAIL : '');
  const [password, setPassword] = useState(DEV_MODE && !inviteToken ? DEV_PASSWORD : '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));

  useEffect(() => {
    if (!inviteToken) {
      setInviteLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const peek = await api.peekStaffInvite(inviteToken);
        if (cancelled) return;
        if (!peek.ok) {
          setError(peek.reason);
          setInviteNote(null);
          return;
        }
        setEmail(peek.email);
        setPassword(peek.password);
        setShowPassword(false);
        setInviteNote('Your invite is ready. Sign in to open the staff portal.');
        setError(null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

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
      if (inviteToken) {
        try {
          await api.acceptStaffInvite(inviteToken);
        } catch (err) {
          setError(errorMessage(err));
          return;
        }
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
          <h1 className="staff-title">
            {inviteToken ? 'Accept your invite' : 'Operations sign in'}
          </h1>
          <p className="staff-lede">
            {inviteToken
              ? 'Review your prefilled credentials, then sign in to activate access.'
              : 'Restricted access for BLD administrators.'}
          </p>

          <form className="staff-form" onSubmit={onSubmit} noValidate>
            {DEV_MODE && !inviteToken && (
              <div className="alert info">
                <Info size={17} />
                <span>Dev mode: prefilled with the fixed admin test account.</span>
              </div>
            )}
            {inviteNote && (
              <div className="alert info">
                <Info size={17} />
                <span>{inviteNote}</span>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}
            {inviteLoading ? (
              <div className="alert info">
                <Info size={17} />
                <span>Loading invite…</span>
              </div>
            ) : null}
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
                  disabled={inviteLoading}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-icon staff-password-field">
                <Lock size={16} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={inviteLoading}
                />
                <button
                  type="button"
                  className="staff-password-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button className="btn block" type="submit" disabled={busy || inviteLoading}>
              {busy ? <span className="spin" /> : null}
              {busy
                ? 'Signing in…'
                : inviteToken
                  ? 'Accept invite & sign in'
                  : 'Sign in to operations'}
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

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="staff-shell">
          <section className="staff-main">
            <div className="staff-card">
              <p className="staff-lede">Loading…</p>
            </div>
          </section>
        </main>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}
