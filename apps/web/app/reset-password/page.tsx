'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
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
    <div className="reset-page">
      <div className="reset-card">
        <div className="reset-brand">BLD</div>

        {peeking ? (
          <p className="reset-lede">Checking your reset link…</p>
        ) : peekError ? (
          <>
            <h1 className="reset-title">Link expired</h1>
            <div className="alert error" role="alert">
              <AlertCircle size={17} />
              <span>{peekError}</span>
            </div>
            <Link className="btn block" href="/?auth=login">
              Back to login
            </Link>
          </>
        ) : done ? (
          <>
            <div className="reset-success-icon" aria-hidden>
              <CheckCircle2 size={36} strokeWidth={1.8} />
            </div>
            <h1 className="reset-title">Password updated</h1>
            <p className="reset-lede">
              Your password for <strong>{emailMasked}</strong> has been saved. You can sign in now.
            </p>
            <button
              type="button"
              className="btn block"
              onClick={() => router.push('/?auth=login')}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <h1 className="reset-title">Set a new password</h1>
            <p className="reset-lede">
              Resetting password for <strong>{emailMasked}</strong>. This link only works for that
              account.
            </p>
            <form onSubmit={onSubmit} noValidate className="reset-form">
              {error && (
                <div className="alert error" role="alert">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordStrength password={password} />
              </div>
              <div className="field">
                <label htmlFor="reset-confirm">Confirm password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <button className="btn block" type="submit" disabled={busy}>
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
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="reset-page">
          <div className="reset-card">
            <div className="reset-brand">BLD</div>
            <p className="reset-lede">Loading…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
