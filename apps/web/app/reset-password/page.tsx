'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Shield,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { PasswordStrength, passwordMeetsPolicy } from '../../components/password-strength';

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = (search.get('token') ?? '').trim();

  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [peekError, setPeekError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [peeking, setPeeking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function peek() {
      if (!token) {
        setPeekError('This reset link is missing or incomplete. Request a new one from sign in.');
        setPeeking(false);
        return;
      }
      try {
        const result = await api.peekResetPassword(token);
        if (cancelled) return;
        if (!result.ok) {
          setPeekError(result.reason);
        } else {
          setEmailMasked(result.emailMasked);
        }
      } catch (err) {
        if (!cancelled) setPeekError(errorMessage(err));
      } finally {
        if (!cancelled) setPeeking(false);
      }
    }
    void peek();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordMeetsPolicy(password)) {
      setError('Choose a stronger password — meet all the checks below.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-shell">
      <aside className="reset-aside" aria-hidden>
        <div className="reset-aside-inner">
          <Image
            src="/brand/bld-logo-dark.png"
            alt=""
            width={636}
            height={236}
            className="reset-aside-logo"
            priority
          />
          <p className="reset-aside-kicker">
            <KeyRound size={13} strokeWidth={2.4} />
            Password reset
          </p>
          <h2 className="reset-aside-title">Choose a new password</h2>
          <p className="reset-aside-copy">
            This link is unique to your account. Pick something strong — then you&apos;re back into
            BLD.
          </p>
          <ul className="reset-aside-points">
            <li>
              <Shield size={15} strokeWidth={2.2} />
              One-time secure link
            </li>
            <li>
              <Lock size={15} strokeWidth={2.2} />
              Expires in 60 minutes
            </li>
          </ul>
        </div>
      </aside>

      <section className="reset-main">
        <div className="reset-card">
          <div className="reset-card-brand">
            <Image
              src="/brand/bld-logo-dark.png"
              alt="BLD"
              width={636}
              height={236}
              className="reset-logo"
              priority
            />
          </div>

          {peeking ? (
            <>
              <p className="reset-kicker">
                <KeyRound size={13} strokeWidth={2.4} />
                Password reset
              </p>
              <h1 className="reset-title">Almost there</h1>
              <p className="reset-lede">Checking your reset link…</p>
              <div className="reset-skeleton" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </>
          ) : peekError ? (
            <>
              <div className="reset-state-icon reset-state-icon--error" aria-hidden>
                <AlertCircle size={28} strokeWidth={1.9} />
              </div>
              <h1 className="reset-title">Link expired</h1>
              <div className="alert error" role="alert">
                <AlertCircle size={17} />
                <span>{peekError}</span>
              </div>
              <Link className="btn block reset-cta" href="/?auth=login">
                Back to login
              </Link>
            </>
          ) : done ? (
            <>
              <div className="reset-state-icon reset-state-icon--ok" aria-hidden>
                <CheckCircle2 size={28} strokeWidth={1.9} />
              </div>
              <h1 className="reset-title">Password updated</h1>
              <p className="reset-lede">
                Your password for <strong>{emailMasked}</strong> has been saved. You can sign in
                now.
              </p>
              <button
                type="button"
                className="btn block reset-cta"
                onClick={() => router.push('/?auth=login')}
              >
                Back to login
              </button>
            </>
          ) : (
            <>
              <p className="reset-kicker">
                <KeyRound size={13} strokeWidth={2.4} />
                Password reset
              </p>
              <h1 className="reset-title">Set a new password</h1>
              <p className="reset-lede">
                Choose a strong password for this account. You&apos;ll use it next time you sign
                in.
              </p>
              {emailMasked ? (
                <div className="reset-account" title={emailMasked}>
                  <Lock size={14} strokeWidth={2.2} />
                  <span>{emailMasked}</span>
                </div>
              ) : null}

              <form onSubmit={onSubmit} noValidate className="reset-form">
                {error && (
                  <div className="alert error" role="alert">
                    <AlertCircle size={17} />
                    <span>{error}</span>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="reset-password">New password</label>
                  <div className="reset-input">
                    <Lock size={16} className="reset-input-icon" aria-hidden />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a new password"
                    />
                    <button
                      type="button"
                      className="reset-eye"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>
                <div className="field">
                  <label htmlFor="reset-confirm">Confirm password</label>
                  <div className="reset-input">
                    <Lock size={16} className="reset-input-icon" aria-hidden />
                    <input
                      id="reset-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                    />
                    <button
                      type="button"
                      className="reset-eye"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <button className="btn block reset-cta" type="submit" disabled={busy}>
                  {busy ? <span className="spin" /> : null}
                  {busy ? 'Saving…' : 'Save new password'}
                </button>
              </form>
              <Link className="reset-back" href="/?auth=login">
                <ArrowLeft size={15} strokeWidth={2.2} />
                Back to login
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="reset-shell">
          <aside className="reset-aside" aria-hidden>
            <div className="reset-aside-inner">
              <div className="reset-aside-logo reset-aside-logo--fallback">BLD</div>
              <p className="reset-aside-kicker">Password reset</p>
              <h2 className="reset-aside-title">Choose a new password</h2>
            </div>
          </aside>
          <section className="reset-main">
            <div className="reset-card">
              <p className="reset-lede">Loading…</p>
            </div>
          </section>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
