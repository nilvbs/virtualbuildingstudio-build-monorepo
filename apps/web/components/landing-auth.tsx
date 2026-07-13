'use client';

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, Info, Lock, Mail, Phone, User, X } from 'lucide-react';
import type { RoleHint } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { setSession } from '../lib/session';
import { GoogleButton } from './google-button';

export type AuthMode = 'login' | 'signup';

const DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === 'true';
const DEV_EMAIL = 'dev@surveylink.local';
const DEV_PASSWORD = 'devpass123';

function roleFromQuery(raw: string | null): RoleHint {
  if (raw === 'client' || raw === 'surveyor') return raw;
  return 'client';
}

export function LandingAuthOverlay({
  open,
  mode,
  roleHint,
  created,
  onClose,
  onModeChange,
  onRoleChange,
}: {
  open: boolean;
  mode: AuthMode;
  roleHint: RoleHint;
  created?: boolean;
  onClose: () => void;
  onModeChange: (mode: AuthMode, opts?: { created?: boolean }) => void;
  onRoleChange: (role: RoleHint) => void;
}) {
  const titleId = useId();
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState(DEV_MODE ? DEV_EMAIL : '');
  const [loginPassword, setLoginPassword] = useState(DEV_MODE ? DEV_PASSWORD : '');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [signup, setSignup] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupBusy, setSignupBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setLoginError(null);
    setSignupError(null);
  }, [open, mode]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      const session = await api.login({ email: loginEmail, password: loginPassword });
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + session.expiresIn * 1000,
      });
      const me = await api.me();
      if (me.roleHint === 'client') router.push('/client');
      else router.push('/surveyor');
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setLoginBusy(false);
    }
  }

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupBusy(true);
    try {
      await api.signup({ ...signup, roleHint });
      onModeChange('login', { created: true });
      setLoginEmail(signup.email);
      setLoginPassword('');
    } catch (err) {
      setSignupError(errorMessage(err));
    } finally {
      setSignupBusy(false);
    }
  }

  return (
    <div
      className={`mkt-auth ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="mkt-auth-backdrop"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className="mkt-auth-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open ? true : undefined}
      >
        <div className="mkt-auth-panel-inner">
          <header className="mkt-auth-head">
            <div>
              <p className="mkt-auth-kicker">{mode === 'login' ? 'Welcome back' : 'Join BLD'}</p>
              <h2 id={titleId} className="mkt-auth-title">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
            </div>
            <button type="button" className="mkt-auth-close" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2.2} />
            </button>
          </header>

          <div className="mkt-auth-tabs" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`mkt-auth-tab ${mode === 'login' ? 'is-active' : ''}`}
              onClick={() => onModeChange('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`mkt-auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
              onClick={() => onModeChange('signup')}
            >
              Create account
            </button>
          </div>

          <div className="mkt-auth-body" key={mode}>
            {mode === 'login' ? (
              <>
                <p className="mkt-auth-lede">Sign in as a client or surveyor.</p>
                <GoogleButton label="Sign in with Google" />
                <div className="auth-or">
                  <span>or</span>
                </div>
                <form onSubmit={onLogin} noValidate>
                  {DEV_MODE && (
                    <div className="alert info">
                      <Info size={17} />
                      <span>Dev mode: prefilled with the fixed test account.</span>
                    </div>
                  )}
                  {(created || signup.email) && !loginError && (
                    <div className="alert success">
                      <Info size={17} />
                      <span>Account ready — sign in to continue.</span>
                    </div>
                  )}
                  {loginError && (
                    <div className="alert error" role="alert">
                      <AlertCircle size={17} />
                      <span>{loginError}</span>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="mkt-login-email">Email</label>
                    <div className="input-icon">
                      <Mail size={16} />
                      <input
                        id="mkt-login-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="mkt-login-password">Password</label>
                    <div className="input-icon">
                      <Lock size={16} />
                      <input
                        id="mkt-login-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <button className="btn block" type="submit" disabled={loginBusy}>
                    {loginBusy ? <span className="spin" /> : null}
                    {loginBusy ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mkt-auth-lede">Join as a client or surveyor.</p>
                <GoogleButton role={roleHint} label="Sign up with Google" />
                <div className="auth-or">
                  <span>or</span>
                </div>
                <form onSubmit={onSignup} noValidate>
                  {signupError && (
                    <div className="alert error" role="alert">
                      <AlertCircle size={17} />
                      <span>{signupError}</span>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="mkt-signup-name">Full name</label>
                    <div className="input-icon">
                      <User size={16} />
                      <input
                        id="mkt-signup-name"
                        type="text"
                        required
                        value={signup.fullName}
                        onChange={(e) => setSignup((s) => ({ ...s, fullName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="mkt-signup-email">Email</label>
                    <div className="input-icon">
                      <Mail size={16} />
                      <input
                        id="mkt-signup-email"
                        type="email"
                        required
                        value={signup.email}
                        onChange={(e) => setSignup((s) => ({ ...s, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="mkt-signup-phone">Phone</label>
                    <div className="input-icon">
                      <Phone size={16} />
                      <input
                        id="mkt-signup-phone"
                        type="text"
                        required
                        placeholder="+14155552671"
                        value={signup.phone}
                        onChange={(e) => setSignup((s) => ({ ...s, phone: e.target.value }))}
                      />
                    </div>
                    <span className="hint">E.164 format, e.g. +14155552671</span>
                  </div>
                  <div className="field">
                    <label htmlFor="mkt-signup-password">Password</label>
                    <input
                      id="mkt-signup-password"
                      type="password"
                      required
                      value={signup.password}
                      onChange={(e) => setSignup((s) => ({ ...s, password: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="mkt-signup-role">I am a</label>
                    <select
                      id="mkt-signup-role"
                      value={roleHint}
                      onChange={(e) => onRoleChange(e.target.value as RoleHint)}
                    >
                      <option value="client">Client — I need surveys</option>
                      <option value="surveyor">Surveyor — I offer surveys</option>
                    </select>
                  </div>
                  <button className="btn block" type="submit" disabled={signupBusy}>
                    {signupBusy ? <span className="spin" /> : null}
                    {signupBusy ? 'Creating…' : 'Create account'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function useLandingAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get('auth');
  const open = modeParam === 'login' || modeParam === 'signup';
  const mode: AuthMode = modeParam === 'signup' ? 'signup' : 'login';
  const roleHint = roleFromQuery(searchParams.get('role'));
  const created = searchParams.get('created') === '1';

  const syncUrl = useCallback(
    (next: { auth?: AuthMode | null; role?: RoleHint; created?: boolean }) => {
      const params = new URLSearchParams();
      if (next.auth) params.set('auth', next.auth);
      if (next.auth === 'signup' && next.role) params.set('role', next.role);
      if (next.created) params.set('created', '1');
      const q = params.toString();
      router.replace(q ? `/?${q}` : '/', { scroll: false });
    },
    [router],
  );

  const openAuth = useCallback(
    (nextMode: AuthMode, role?: RoleHint) => {
      syncUrl({
        auth: nextMode,
        role: role ?? roleHint,
        created: nextMode === 'login' && created ? true : undefined,
      });
    },
    [syncUrl, roleHint, created],
  );

  const closeAuth = useCallback(() => syncUrl({ auth: null }), [syncUrl]);

  const setMode = useCallback(
    (nextMode: AuthMode, opts?: { created?: boolean }) => {
      syncUrl({
        auth: nextMode,
        role: roleHint,
        created: opts?.created ?? (nextMode === 'login' ? created : undefined),
      });
    },
    [syncUrl, roleHint, created],
  );

  const setRole = useCallback(
    (role: RoleHint) => {
      syncUrl({ auth: 'signup', role });
    },
    [syncUrl],
  );

  return { open, mode, roleHint, created, openAuth, closeAuth, setMode, setRole };
}
