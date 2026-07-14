'use client';

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Building2, HardHat, Info, Lock, Mail, User, X } from 'lucide-react';
import type { WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { homePathForUser, homePathForWorkspace } from '../lib/home';
import { isAuthenticated, setSession } from '../lib/session';
import { GoogleButton } from './google-button';
import { defaultPhoneInput, PhoneInput, phoneInputIsValid, phoneInputToE164 } from './phone-input';

export type AuthMode = 'login' | 'signup';

const DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === 'true';
const DEV_EMAIL = 'dev@surveylink.local';
const DEV_PASSWORD = 'devpass123';

function roleFromQuery(raw: string | null): WorkspaceRole | null {
  if (raw === 'client' || raw === 'surveyor') return raw;
  return null;
}

function workspaceLabel(role: WorkspaceRole): string {
  return role === 'surveyor' ? 'Expert (surveyor)' : 'Client';
}

export function LandingAuthOverlay({
  open,
  mode,
  role,
  created,
  onClose,
  onModeChange,
  onRoleChange,
  onClearRole,
}: {
  open: boolean;
  mode: AuthMode;
  role: WorkspaceRole | null;
  created?: boolean;
  onClose: () => void;
  onModeChange: (mode: AuthMode, opts?: { created?: boolean; role?: WorkspaceRole }) => void;
  onRoleChange: (role: WorkspaceRole) => void;
  onClearRole: () => void;
}) {
  const titleId = useId();
  const router = useRouter();
  const roleChosen = role !== null;

  const [loginEmail, setLoginEmail] = useState(DEV_MODE ? DEV_EMAIL : '');
  const [loginPassword, setLoginPassword] = useState(DEV_MODE ? DEV_PASSWORD : '');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [signup, setSignup] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [signupPhone, setSignupPhone] = useState(defaultPhoneInput);
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
  }, [open, mode, role]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoginError(null);
    setLoginBusy(true);
    try {
      const session = await api.login({
        email: loginEmail,
        password: loginPassword,
        role,
      });
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + session.expiresIn * 1000,
        activeRole: session.activeRole ?? role,
      });
      router.push(homePathForWorkspace(session.activeRole ?? role));
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setLoginBusy(false);
    }
  }

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setSignupError(null);

    if (!phoneInputIsValid(signupPhone)) {
      setSignupError('Enter a valid phone number for the selected country (include country code).');
      setSignupBusy(false);
      return;
    }

    setSignupBusy(true);
    try {
      const e164 = phoneInputToE164(signupPhone);
      await api.signup({
        ...signup,
        phone: e164,
        roleHint: role,
      });
      setLoginEmail(signup.email);
      setLoginPassword('');
      setSignupPhone(defaultPhoneInput());
      onModeChange('login', { created: true, role });
    } catch (err) {
      setSignupError(errorMessage(err));
    } finally {
      setSignupBusy(false);
    }
  }

  return (
    <div className={`mkt-auth ${open ? 'is-open' : ''}`} aria-hidden={!open}>
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
              <p className="mkt-auth-kicker">
                {!roleChosen ? 'Get started' : mode === 'login' ? 'Welcome back' : 'Join BLD'}
              </p>
              <h2 id={titleId} className="mkt-auth-title">
                {!roleChosen
                  ? 'Who are you?'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </h2>
            </div>
            <button type="button" className="mkt-auth-close" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2.2} />
            </button>
          </header>

          {!roleChosen ? (
            <div className="mkt-auth-body" key="role">
              <p className="mkt-auth-lede">
                Pick your workspace first. Then you can sign in or create an account.
              </p>
              <div className="mkt-auth-roles" role="group" aria-label="Choose workspace">
                <button
                  type="button"
                  className="mkt-auth-role"
                  onClick={() => onRoleChange('client')}
                >
                  <span className="mkt-auth-role-icon" aria-hidden>
                    <Building2 size={22} strokeWidth={1.8} />
                  </span>
                  <span className="mkt-auth-role-copy">
                    <strong>Client</strong>
                    <span>I need surveys for a site</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="mkt-auth-role"
                  onClick={() => onRoleChange('surveyor')}
                >
                  <span className="mkt-auth-role-icon" aria-hidden>
                    <HardHat size={22} strokeWidth={1.8} />
                  </span>
                  <span className="mkt-auth-role-copy">
                    <strong>Expert (surveyor)</strong>
                    <span>I offer survey services</span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="mkt-auth-back" onClick={onClearRole}>
                <ArrowLeft size={15} strokeWidth={2.2} />
                {workspaceLabel(role)}
                <span className="mkt-auth-back-change">Change</span>
              </button>

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
                    <p className="mkt-auth-lede">Sign in to your {workspaceLabel(role).toLowerCase()} workspace.</p>
                    <GoogleButton role={role} label="Sign in with Google" />
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
                    <p className="mkt-auth-lede">Create your {workspaceLabel(role).toLowerCase()} account.</p>
                    <GoogleButton role={role} label="Sign up with Google" />
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
                      <PhoneInput
                        id="mkt-signup-phone"
                        value={signupPhone}
                        onChange={setSignupPhone}
                        required
                        disabled={signupBusy}
                      />
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
                      <button className="btn block" type="submit" disabled={signupBusy}>
                        {signupBusy ? <span className="spin" /> : null}
                        {signupBusy ? 'Creating…' : 'Create account'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </>
          )}
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
  const role = roleFromQuery(searchParams.get('role'));
  const created = searchParams.get('created') === '1';

  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) router.replace(homePathForUser(user));
      })
      .catch(() => {
        /* stale token — leave landing / login UI available */
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const syncUrl = useCallback(
    (next: { auth?: AuthMode | null; role?: WorkspaceRole | null; created?: boolean }) => {
      const params = new URLSearchParams();
      if (next.auth) params.set('auth', next.auth);
      if (next.role === 'client' || next.role === 'surveyor') params.set('role', next.role);
      if (next.created) params.set('created', '1');
      const q = params.toString();
      router.replace(q ? `/?${q}` : '/', { scroll: false });
    },
    [router],
  );

  const openAuth = useCallback(
    (nextMode: AuthMode, nextRole?: WorkspaceRole) => {
      syncUrl({
        auth: nextMode,
        role: nextRole ?? null,
        created: undefined,
      });
    },
    [syncUrl],
  );

  const closeAuth = useCallback(() => syncUrl({ auth: null }), [syncUrl]);

  const setMode = useCallback(
    (nextMode: AuthMode, opts?: { created?: boolean; role?: WorkspaceRole }) => {
      syncUrl({
        auth: nextMode,
        role: opts?.role ?? role,
        created: opts?.created ?? (nextMode === 'login' ? created : undefined),
      });
    },
    [syncUrl, role, created],
  );

  const setRole = useCallback(
    (nextRole: WorkspaceRole) => {
      syncUrl({
        auth: mode === 'login' || mode === 'signup' ? mode : 'signup',
        role: nextRole,
        created: mode === 'login' ? created : undefined,
      });
    },
    [syncUrl, mode, created],
  );

  const clearRole = useCallback(() => {
    syncUrl({
      auth: mode,
      role: null,
      created: undefined,
    });
  }, [syncUrl, mode]);

  return { open, mode, role, created, openAuth, closeAuth, setMode, setRole, clearRole };
}
