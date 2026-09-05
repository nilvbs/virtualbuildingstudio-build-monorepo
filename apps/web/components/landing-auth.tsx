'use client';

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Building2, HardHat, Info } from 'lucide-react';
import { LordIcon } from './lord-icon';
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
  return role === 'surveyor' ? 'Surveyor' : 'Client';
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

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);

  const [signup, setSignup] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [signupPhone, setSignupPhone] = useState(() => defaultPhoneInput());
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupBusy, setSignupBusy] = useState(false);
  const reduceMotion = useReducedMotion();

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
    setForgotError(null);
    setForgotSent(false);
    setForgotOpen(false);
  }, [open, mode, role]);

  function openForgot() {
    setForgotEmail(loginEmail);
    setForgotError(null);
    setForgotSent(false);
    setForgotOpen(true);
  }

  function closeForgot() {
    setForgotOpen(false);
    setForgotError(null);
    setForgotSent(false);
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setForgotError(null);
    setForgotBusy(true);
    try {
      await api.forgotPassword({ email: forgotEmail, role });
      setForgotSent(true);
      setLoginEmail(forgotEmail);
    } catch (err) {
      setForgotError(errorMessage(err));
    } finally {
      setForgotBusy(false);
    }
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoginError(null);
    setLoginBusy(true);
    try {
      await finishPasswordLogin(loginEmail, loginPassword, role);
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setLoginBusy(false);
    }
  }

  async function finishPasswordLogin(email: string, password: string, workspace: WorkspaceRole) {
    const session = await api.login({
      email,
      password,
      role: workspace,
    });
    setSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: Date.now() + session.expiresIn * 1000,
      activeRole: session.activeRole ?? workspace,
    });
    const onboarding = await api.getOnboarding().catch(() => null);
    router.push(
      onboarding && onboarding.step !== 'done'
        ? '/onboarding'
        : homePathForWorkspace(session.activeRole ?? workspace),
    );
  }

  /** Local-only: skip Google / forms and land in the surveyor workspace. */
  async function enterDevSurveyor() {
    setLoginError(null);
    setSignupError(null);
    setLoginBusy(true);
    try {
      await finishPasswordLogin(DEV_EMAIL, DEV_PASSWORD, 'surveyor');
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
      const { session } = await api.signup({
        ...signup,
        phone: e164,
        roleHint: role,
      });
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + session.expiresIn * 1000,
        activeRole: session.activeRole ?? role,
      });
      setLoginEmail(signup.email);
      setLoginPassword('');
      setSignupPhone(defaultPhoneInput());
      router.push('/onboarding');
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
                {forgotOpen
                  ? 'Reset access'
                  : !roleChosen
                    ? 'Get started'
                    : mode === 'login'
                      ? 'Welcome back'
                      : `Join as a ${workspaceLabel(role).toLowerCase()}`}
              </p>
              <h2 id={titleId} className="mkt-auth-title">
                {forgotOpen
                  ? 'Forgot password'
                  : !roleChosen
                    ? 'Who are you?'
                    : mode === 'login'
                      ? 'Sign in'
                      : 'Create account'}
              </h2>
            </div>
            <button type="button" className="mkt-auth-close" onClick={onClose} aria-label="Close">
              <LordIcon name="close" size={22} trigger="hover" />
            </button>
          </header>

          {!roleChosen ? (
            <div className="mkt-auth-body">
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
                    <strong>Surveyor</strong>
                    <span>I offer survey services</span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {forgotOpen ? (
                <button type="button" className="mkt-auth-back" onClick={closeForgot}>
                  <ArrowLeft size={15} strokeWidth={2.2} />
                  Back to sign in
                </button>
              ) : (
                <button type="button" className="mkt-auth-back" onClick={onClearRole}>
                  <ArrowLeft size={15} strokeWidth={2.2} />
                  {workspaceLabel(role)}
                  <span className="mkt-auth-back-change">Change</span>
                </button>
              )}

              {!forgotOpen && (
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
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  className="mkt-auth-body"
                  key={forgotOpen ? 'forgot' : `${mode}-${role}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  {forgotOpen ? (
                    <>
                      <p className="mkt-auth-lede">
                        Enter the email for your {workspaceLabel(role).toLowerCase()} account and
                        we&apos;ll send a reset link.
                      </p>
                      {forgotSent ? (
                        <div className="alert success" role="status">
                          <Info size={17} />
                          <span>
                            If an account exists for that email, we sent a password reset link. Check
                            your inbox, then return to sign in.
                          </span>
                        </div>
                      ) : (
                        <form onSubmit={onForgot} noValidate>
                          {forgotError && (
                            <div className="alert error" role="alert">
                              <AlertCircle size={17} />
                              <span>{forgotError}</span>
                            </div>
                          )}
                          <div className="field">
                            <label htmlFor="mkt-forgot-email">Email</label>
                            <div className="input-icon">
                              <LordIcon name="mail" size={18} trigger="hover" />
                              <input
                                id="mkt-forgot-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                              />
                            </div>
                          </div>
                          <button className="btn block" type="submit" disabled={forgotBusy}>
                            {forgotBusy ? <span className="spin" /> : null}
                            {forgotBusy ? 'Sending…' : 'Send reset link'}
                          </button>
                        </form>
                      )}
                      {forgotSent && (
                        <button type="button" className="btn block" onClick={closeForgot}>
                          Back to sign in
                        </button>
                      )}
                    </>
                  ) : mode === 'login' ? (
                    <>
                      <p className="mkt-auth-lede">
                        Sign in to your {workspaceLabel(role).toLowerCase()} workspace.
                      </p>
                      {DEV_MODE && role === 'surveyor' && (
                        <button
                          type="button"
                          className="btn block"
                          onClick={() => void enterDevSurveyor()}
                          disabled={loginBusy}
                          style={{ marginBottom: 12 }}
                        >
                          {loginBusy ? <span className="spin" /> : null}
                          {loginBusy ? 'Entering surveyor…' : 'Enter as surveyor (local)'}
                        </button>
                      )}
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
                            <LordIcon name="mail" size={18} trigger="hover" />
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
                          <div className="mkt-auth-label-row">
                            <label htmlFor="mkt-login-password">Password</label>
                            <button
                              type="button"
                              className="mkt-auth-forgot"
                              onClick={openForgot}
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div className="input-icon">
                            <LordIcon name="security" size={18} trigger="hover" />
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
                      <p className="mkt-auth-lede">
                        Create your {workspaceLabel(role).toLowerCase()} account.
                      </p>
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
                            <LordIcon name="avatar" size={18} trigger="hover" />
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
                            <LordIcon name="mail" size={18} trigger="hover" />
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
                </motion.div>
              </AnimatePresence>
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
  const wantDevSurveyor = DEV_MODE && searchParams.get('dev') === 'surveyor';

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

  // Local shortcut: /?auth=login&dev=surveyor logs in and opens /surveyor.
  useEffect(() => {
    if (!wantDevSurveyor || isAuthenticated()) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await api.login({
          email: DEV_EMAIL,
          password: DEV_PASSWORD,
          role: 'surveyor',
        });
        if (cancelled) return;
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: Date.now() + session.expiresIn * 1000,
          activeRole: 'surveyor',
        });
        router.replace('/surveyor');
      } catch {
        /* fall through to normal auth UI */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wantDevSurveyor, router]);

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
