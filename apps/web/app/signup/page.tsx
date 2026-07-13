'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Compass, Mail, Phone, User } from 'lucide-react';
import type { RoleHint } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';

function roleFromQuery(raw: string | null): RoleHint {
  if (raw === 'client' || raw === 'surveyor') return raw;
  return 'client';
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = useMemo(() => roleFromQuery(searchParams.get('role')), [searchParams]);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roleHint: initialRole as RoleHint,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm((f) => (f.roleHint === initialRole ? f : { ...f, roleHint: initialRole }));
  }, [initialRole]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.signup(form);
      router.push('/login?created=1');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
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
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Create your account</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 22 }}>
          Join as a client or surveyor.
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
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-icon">
              <Mail size={16} />
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <div className="input-icon">
              <Phone size={16} />
              <input
                id="phone"
                type="text"
                required
                placeholder="+14155552671"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <span className="hint">E.164 format, e.g. +14155552671</span>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="roleHint">I am a</label>
            <select
              id="roleHint"
              value={form.roleHint}
              onChange={(e) => set('roleHint', e.target.value as RoleHint)}
            >
              <option value="client">Client — I need surveys</option>
              <option value="surveyor">Surveyor — I offer surveys</option>
            </select>
          </div>
          <button className="btn block" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? <span className="spin" /> : null}
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="auth-foot">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <Suspense fallback={<div className="auth-card">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
